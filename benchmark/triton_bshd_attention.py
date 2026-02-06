import os
import torch
import triton
import triton.language as tl

from kernel_bench.config.types.attention import AttentionConfigBSHD
from kernel_bench.core.template import KernelBenchmark
from kernel_bench.kernels.attention.bshd.bshd_utils import (
    BSHDMetaData,
    get_bshd_inputs,
    get_bshd_shape_from_layout,
)
from kernel_bench.utils.dtypes.device_context import DeviceContext
from kernel_bench.utils.torch_utils import benchmark_function_torch


# Flash Attention v2 kernel functions from ROCm Triton
@triton.jit
def cdiv_fn(x, y):
    return (x + y - 1) // y


@triton.jit
def max_fn(x, y):
    return tl.math.max(x, y)


@triton.jit
def load_fn(ptrs, offset_first, offset_second, boundary_first, boundary_second):
    if offset_first is not None and offset_second is not None:
        mask = (offset_first[:, None] < boundary_first) & \
               (offset_second[None, :] < boundary_second)
        tensor = tl.load(ptrs, mask=mask, other=0.0)
    elif offset_first is not None:
        mask = offset_first[:, None] < boundary_first
        tensor = tl.load(ptrs, mask=mask, other=0.0)
    elif offset_second is not None:
        mask = offset_second[None, :] < boundary_second
        tensor = tl.load(ptrs, mask=mask, other=0.0)
    else:
        tensor = tl.load(ptrs)
    return tensor


def is_hip():
    return triton.runtime.driver.active.get_current_target().backend == "hip"


def is_cdna():
    return is_hip() and triton.runtime.driver.active.get_current_target().arch in ('gfx950', 'gfx940', 'gfx941',
                                                                                   'gfx942', 'gfx90a', 'gfx908')


def get_fwd_config():
    return [
        triton.Config({'BLOCK_M': 256, 'BLOCK_N': 64, 'waves_per_eu': 2, 'PRE_LOAD_V': False},
                      num_stages=4, num_warps=8),
    ]


@triton.autotune(
    configs=get_fwd_config(),
    key=['N_CTX_Q', 'N_CTX_K', 'D_HEAD', 'IS_CAUSAL'],
)
@triton.jit
def _fwd_kernel(
    Q, K, V, Out,
    stride_qz, stride_qh, stride_qm, stride_qk,
    stride_kz, stride_kh, stride_kn, stride_kk,
    stride_vz, stride_vh, stride_vk, stride_vn,
    stride_oz, stride_oh, stride_om, stride_on,
    Z, HQ, HK, N_CTX_Q, N_CTX_K, D_HEAD,
    SM_SCALE: tl.constexpr,
    IS_CAUSAL: tl.constexpr,
    BLOCK_M: tl.constexpr, BLOCK_DMODEL: tl.constexpr,
    BLOCK_N: tl.constexpr, PRE_LOAD_V: tl.constexpr,
):
    start_m = tl.program_id(0)
    off_h_q = tl.program_id(1)
    off_z = tl.program_id(2)
    
    # GQA/MQA support - compute KV head index
    # For MQA/GQA, multiple query heads share the same KV head
    off_h_k = off_h_q // (HQ // HK)

    offs_m = start_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_n = tl.arange(0, BLOCK_N)
    offs_d = tl.arange(0, BLOCK_DMODEL)

    # Compute pointers
    q_offset = Q + off_z * stride_qz + off_h_q * stride_qh
    q_ptrs = q_offset + offs_m[:, None] * stride_qm + offs_d[None, :] * stride_qk
    
    k_offset = K + off_z * stride_kz + off_h_k * stride_kh
    k_ptrs = k_offset + offs_d[:, None] * stride_kk + offs_n[None, :] * stride_kn
    
    v_offset = V + off_z * stride_vz + off_h_k * stride_vh
    v_ptrs = v_offset + offs_n[:, None] * stride_vk + offs_d[None, :] * stride_vn
    
    # Initialize accumulators
    m_i = tl.full([BLOCK_M], float("-inf"), dtype=tl.float32)
    l_i = tl.full([BLOCK_M], 1.0, dtype=tl.float32)
    acc = tl.zeros([BLOCK_M, BLOCK_DMODEL], dtype=tl.float32)
    
    # Load Q
    q_mask = offs_m[:, None] < N_CTX_Q
    q = tl.load(q_ptrs, mask=q_mask, other=0.0)
    
    # Scale for attention
    QK_SCALE: tl.constexpr = SM_SCALE * 1.44269504089  # log2(e)
    
    # Compute number of blocks
    num_blocks = tl.cdiv(N_CTX_K, BLOCK_N)
    
    # For causal masking, limit how many blocks we need to process
    if IS_CAUSAL:
        # Calculate the maximum block we need to process for this row
        # For causal attention, we only attend to tokens up to the current position
        n_blocks_seqlen = tl.cdiv((start_m + 1) * BLOCK_M + N_CTX_K - N_CTX_Q, BLOCK_N)
        num_blocks = min(num_blocks, n_blocks_seqlen)
    
    # Loop over K, V
    for start_n in range(0, num_blocks * BLOCK_N, BLOCK_N):
        k_offs_n = start_n + tl.arange(0, BLOCK_N)
        k_mask = k_offs_n < N_CTX_K
        
        # Load K, V
        k = load_fn(k_ptrs, None, k_offs_n, D_HEAD, N_CTX_K)
        if PRE_LOAD_V:
            v = load_fn(v_ptrs, k_offs_n, None, N_CTX_K, D_HEAD)
        
        # Compute QK
        qk = tl.dot(q, k)
        
        # Apply causal mask if needed
        if IS_CAUSAL:
            # Create causal mask: only attend to earlier positions
            causal_mask = (offs_m[:, None] + N_CTX_Q - N_CTX_K) >= k_offs_n[None, :]
            qk = tl.where(causal_mask, qk, float("-inf"))
        
        # Apply softmax
        m_ij = tl.maximum(m_i, tl.max(qk, 1))
        m_ij_scaled = m_ij * QK_SCALE
        qk = qk * QK_SCALE - m_ij_scaled[:, None]
        p = tl.math.exp2(qk)
        l_ij = tl.sum(p, 1)
        
        # Update accumulator
        alpha = tl.math.exp2(m_i * QK_SCALE - m_ij_scaled)
        acc = acc * alpha[:, None]
        
        if not PRE_LOAD_V:
            v = load_fn(v_ptrs, k_offs_n, None, N_CTX_K, D_HEAD)
        
        acc += tl.dot(p.to(v.type.element_ty), v)
        
        # Update m_i and l_i
        l_i = l_i * alpha + l_ij
        m_i = m_ij
        
        # Advance pointers
        k_ptrs += BLOCK_N * stride_kn
        v_ptrs += BLOCK_N * stride_vk
    
    # Normalize accumulator
    l_recip = 1 / l_i[:, None]
    acc = acc * l_recip
    
    # Store output
    o_offset = Out + off_z * stride_oz + off_h_q * stride_oh
    o_ptrs = o_offset + offs_m[:, None] * stride_om + offs_d[None, :] * stride_on
    o_mask = offs_m[:, None] < N_CTX_Q
    tl.store(o_ptrs, acc.to(Out.type.element_ty), mask=o_mask)


def triton_bshd_attention_forward(q, k, v, o, metadata):
    """Flash Attention forward pass wrapper"""
    # Get dimensions
    BATCH, N_CTX_Q, HQ, D_HEAD = q.shape
    _, N_CTX_K, HK, _ = k.shape
    
    # Compute scale
    sm_scale = metadata.sm_scale
    
    # Get causal flag
    is_causal = metadata.causal
    
    # Get strides
    stride_qz, stride_qm, stride_qh, stride_qk = q.stride()
    stride_kz, stride_kn, stride_kh, stride_kk = k.stride()
    stride_vz, stride_vk, stride_vh, stride_vn = v.stride()
    stride_oz, stride_om, stride_oh, stride_on = o.stride()
    
    # Get closest power of 2 for head dimension
    padded_d_model = 1 << (D_HEAD - 1).bit_length()
    padded_d_model = max(padded_d_model, 16)
    
    # Launch kernel
    grid = lambda META: (
        triton.cdiv(N_CTX_Q, META['BLOCK_M']),
        HQ,
        BATCH
    )
    
    _fwd_kernel[grid](
        Q=q, K=k, V=v, Out=o,
        stride_qz=stride_qz, stride_qh=stride_qh, stride_qm=stride_qm, stride_qk=stride_qk,
        stride_kz=stride_kz, stride_kh=stride_kh, stride_kn=stride_kn, stride_kk=stride_kk,
        stride_vz=stride_vz, stride_vh=stride_vh, stride_vk=stride_vk, stride_vn=stride_vn,
        stride_oz=stride_oz, stride_oh=stride_oh, stride_om=stride_om, stride_on=stride_on,
        Z=BATCH, HQ=HQ, HK=HK, N_CTX_Q=N_CTX_Q, N_CTX_K=N_CTX_K, D_HEAD=D_HEAD,
        SM_SCALE=sm_scale,
        IS_CAUSAL=is_causal,
        BLOCK_DMODEL=padded_d_model,
    )
    
    return o


class TritonBSHDAttentionBenchmark(KernelBenchmark):
    config: AttentionConfigBSHD

    def run_bench(self, device, num_iterations, timeout=None):
        config = self.config
        in_dtype = self.device_ctx.dtype_to_torch(config.dtype)

        q, k, v, metadata = get_bshd_inputs(
            Z=config.B,
            HQ=config.H,
            HK=config.H_KV,
            N_CTX_Q=config.N_Q,
            N_CTX_K=config.N_KV,
            D_HEAD=config.D_Q,
            dtype=in_dtype,
            layout="bshd",
            requires_grad=False,
        )
        
        # Set causal flag from config
        if config.causal:
            metadata.need_causal()
        
        o = torch.empty_like(q)

        try:
            mean_time_us = benchmark_function_torch(
                triton_bshd_attention_forward,
                warmup=20,
                iterations=100,
                compile=False,
                # Extend attention inputs
                q=q,
                k=k,
                v=v,
                o=o,
                metadata=metadata,
            )

        except Exception as e:
            self.logger.error(
                f"Failed to benchmark kernel {self.config.get_name()}: {e}"
            )
            return self.get_bench_result(0, False)

        return self.get_bench_result(mean_time_us, True)
