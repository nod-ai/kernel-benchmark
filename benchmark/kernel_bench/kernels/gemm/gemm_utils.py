import torch
from dataclasses import dataclass
from typing import override

# Import from new config module
from kernel_bench.config.types.gemm import GemmConfig

# Re-export for backwards compatibility
__all__ = ["GemmConfig"]


def get_torch_reference(x, w, x_scales, w_scales, dtype):
    m, k = x.shape
    n, k = w.shape
    # First convert the x and w inputs to f32.
    x_f32 = mxfp4_to_f32(x)
    w_f32 = mxfp4_to_f32(w)
    # Next convert the e8m0 scales to f32.
    x_scales = x_scales[:m]
    x_scales = x_scales.repeat_interleave(32, dim=1)
    x_scales_f32 = e8m0_to_f32(x_scales)
    x_f32 = x_f32 * x_scales_f32
    w_scales = w_scales[:n]
    w_scales = w_scales.repeat_interleave(32, dim=1)
    w_scales_f32 = e8m0_to_f32(w_scales)
    w_f32 = w_f32 * w_scales_f32
    return torch.mm(x_f32, w_f32.T).to(dtype)[:m, :n]


def get_mxfp4_inputs(M, N, K, slice_scales=True):
    try:
        import aiter
        from aiter.ops.shuffle import shuffle_weight
    except Exception as e:
        import warnings

        warnings.warn(f"Aiter not available: {e}")
        return None, None, None, None

    c_dtype = torch.bfloat16

    x = torch.randn((M, K), device="cuda", dtype=c_dtype)
    w = torch.randn((N, K), device="cuda", dtype=c_dtype)
    quant_func = aiter.get_triton_quant(aiter.QuantType.per_1x32)
    _, x_scale = quant_func(x, shuffle=False)
    _, w_scale = quant_func(w, shuffle=False)
    x, x_scales_shuffle = quant_func(x, shuffle=True)
    w, w_scales_shuffle = quant_func(w, shuffle=True)

    wshuffle = shuffle_weight(w, layout=(16, 16))
    # flops
    flops = 2.0 * M * N * K
    # memory transfer
    mem_read = x.numel() * x.element_size() + w.numel() * w.element_size()
    mem_read += (
        x_scale.numel() * x_scale.element_size()
        + w_scale.numel() * w_scale.element_size()
    )
    mem_write = (M * N) * 2  # TODO: Fix for c_dtype != bf16
    mem = mem_read + mem_write
    out = torch.empty(x.shape[0], w.shape[1], device=x.device, dtype=c_dtype)

    if slice_scales:
        x_scale = x_scale[:M, : K // 32]
        w_scale = w_scale[:N, : K // 32]

    return x, w, x_scale, w_scale, out


def mxfp4_to_f32(x):
    # 2 because we pack fp4 in uint8.
    x = x.repeat_interleave(2, dim=-1)
    x[..., ::2] = x[..., ::2] & 0xF
    x[..., 1::2] = x[..., 1::2] >> 4
    mxfp4_list = [
        0.0,
        0.5,
        1.0,
        1.5,
        2.0,
        3.0,
        4.0,
        6.0,
        -0.0,
        -0.5,
        -1.0,
        -1.5,
        -2.0,
        -3.0,
        -4.0,
        -6.0,
    ]
    mxfp4_in_f32 = torch.tensor(mxfp4_list, dtype=torch.float32, device=x.device)
    return mxfp4_in_f32[x.long()]


def e8m0_to_f32(scale_e8m0_biased):
    scale_e8m0_biased = scale_e8m0_biased.view(torch.uint8)
    zero_case = scale_e8m0_biased == 0
    nan_case = scale_e8m0_biased == 0xFF
    scale_f32 = scale_e8m0_biased.to(torch.int32) << 23
    scale_f32[zero_case] = 0x00400000
    scale_f32[nan_case] = 0x7F800001
    scale_f32 = scale_f32.view(torch.float32)
    return scale_f32
