import os
import torch
from kernel_bench.config.types.attention.bshd_attention_config import (
    bshd_to_attention_attributes,
)
from kernel_bench.kernels.attention.bshd.bshd_utils import get_bshd_inputs
from kernel_bench.tuning.hyperparam import CategoricalBounds, IntegerBounds
from kernel_bench.core.template import WaveTemplate, WaveKernelBenchmark
from kernel_bench.config.types.attention import AttentionConfigBSHD
from typing import override

from kernel_bench.utils.iree_utils import shape_to_iree
from wave_lang.kernel.lang.global_symbols import *
from wave_lang.kernel.wave.constraints import MMAType
from wave_lang.kernel.wave.compile import WaveCompileOptions, wave_compile
from wave_lang.kernel.wave.utils.general_utils import get_default_scheduling_params
from wave_lang.kernel.wave.templates.attention_common import AttentionShape
from wave_lang.kernel.wave.templates.tagged_attention import (
    get_tagged_bshd_attention_kernel,
)
from wave_lang.kernel.wave.schedules.attention_prefetch import (
    get_attention_prefetch_schedule,
)
import wave_lang.kernel.lang as tkl
from wave_lang.kernel.wave.scheduling.schedule_enums import SchedulingType
from wave_lang.kernel.wave.utils.run_utils import set_default_run_config


class WaveBSHDAttentionBenchmark(WaveKernelBenchmark):
    config: AttentionConfigBSHD

    def setup_parameters(self):
        """
        Setup parameters for 4-cluster ping-pong schedule.
        
        Uses fixed configuration optimized for the schedule:
        - MMA variant: F32_16x16x16_F16
        - num_waves: 8 (required for ping-pong)
        - UNROLL_FACTOR: 4
        """
        # Fixed MMA configuration for ping-pong schedule
        self.mfma_variant = self.add_param(
            "MFMA_VARIANT",
            CategoricalBounds(
                [
                    (MMAType.F32_16x16x16_F16, MMAType.F32_16x16x16_F16),
                ]
            ),
            initial_value=0,
            include_hyperparam=False,
        )

    @override
    def load_wave_kernel(self):
        """
        Load Wave attention kernel with 4-cluster ping-pong schedule.
        
        Uses tagged BSHD attention kernel with custom prefetch schedule that
        implements a 4-cluster ping-pong pattern:
        - Cluster 0: QK computation + softmax1
        - Cluster 1: K data movement + V shared load
        - Cluster 2: PV computation + softmax0
        - Cluster 3: V data movement + K shared load
        
        Requires num_waves=8 for ping-pong scheduling with wave staggering.
        """
        config = self.config
        
        # Create AttentionShape from config
        shape = AttentionShape(
            num_query_heads=config.H,
            num_kv_heads=config.H_KV,
            query_seq_len=config.N_Q,
            head_size_kv=config.D_KV,
            head_size=config.D_Q,
            kv_seq_len=config.N_KV,
        )
        
        # MMA variant configuration
        mfma_variant = (MMAType.F32_16x16x16_F16, MMAType.F32_16x16x16_F16)
        
        # Get the tagged BSHD attention kernel with 8 waves for ping-pong
        tagged_attention, hyperparams, dynamic_symbols = get_tagged_bshd_attention_kernel(
            shape,
            mfma_variant,
            dynamic_dims=False,
            is_causal=config.causal,
            num_waves=8,  # Required for ping-pong scheduling
        )
        
        # Update with default scheduling parameters
        hyperparams.update(get_default_scheduling_params())
        
        # Set unroll factor
        UNROLL_FACTOR = tkl.sym.UNROLL_FACTOR
        hyperparams[UNROLL_FACTOR] = 4
        
        # Update with tuning parameters
        hyperparams.update(self.tuning_spec.hyperparams())
        
        return WaveTemplate(
            launchable=tagged_attention,
            hyperparams=hyperparams,
            dynamic_symbols=dynamic_symbols,
            schedule=get_attention_prefetch_schedule(),  # 4-cluster ping-pong schedule
        )

    # def validate_numerics(self, device):
    #     config = self.config
    #     in_dtype = self.device_ctx.dtype_to_torch(config.dtype)
    #     template = self.load_wave_kernel()
    #     options = self.get_compile_options(template)
    #     attention_exec = wave_compile(options, template.launchable)
    #     q, k, v, metadata = get_bshd_inputs(
    #         Z=config.B,
    #         HQ=config.H,
    #         HK=config.H_KV,
    #         N_CTX_Q=config.N_Q,
    #         N_CTX_K=config.N_KV,
    #         D_HEAD=config.D_Q,
    #         dtype=in_dtype,
    #         layout="bshd",
    #         requires_grad=False,
    #     )
    #     o = torch.empty_like(q).to(dtype=torch.float32)
    #     attention_exec(q, k, v, o)
    #     os.makedirs("results/inputs/bshd_attention/wave", exist_ok=True)
    #     os.makedirs("results/outputs/bshd_attention/wave", exist_ok=True)
    #     torch.save(q, f"results/inputs/bshd_attention/wave/{config.get_name()}_q.pt")
    #     torch.save(k, f"results/inputs/bshd_attention/wave/{config.get_name()}_k.pt")
    #     torch.save(v, f"results/inputs/bshd_attention/wave/{config.get_name()}_v.pt")
    #     torch.save(o, f"results/outputs/bshd_attention/wave/{config.get_name()}.pt")
    #     return True

    @override
    def extra_compile_options(self):
        """
        Compile options for 4-cluster ping-pong schedule.
        
        Uses MANUAL scheduling with:
        - GatherToLDS for data movement (global -> shared)
        - Buffer ops for memory operations
        - Loop unrolling with UNROLL_FACTOR=4
        - Linearized shared access disabled to reduce VGPR spills
        """
        return WaveCompileOptions(
            schedule=SchedulingType.MANUAL,  # Use manual schedule with prefetch pattern
            canonicalize=True,
            use_global_to_shared=True,  # Enable GatherToLDS
            use_buffer_ops=True,
            linearize_shared_access=False,  # Reduce VGPR spills
            iree_launch_async=False,
            postprocess="""
            module attributes {transform.with_named_sequence} {
                transform.named_sequence @__transform_main(%arg0: !transform.any_op {transform.readonly}) {
                    %0 = transform.structured.match ops{["scf.for"]} in %arg0 : (!transform.any_op) -> !transform.any_op
                    transform.loop.unroll %0 { factor = %%UNROLL_FACTOR%% } : !transform.any_op
                    transform.yield
                }
            }
            """,
        )

    @override
    def get_runtime_args(self):
        config = self.config
        in_dtype = "f16" if config.dtype == "f8" else config.dtype
        out_dtype = "f32"

        query_shape = shape_to_iree(
            (config.B, config.N_Q, config.H, config.D_Q), in_dtype, self.device_ctx
        )
        key_shape = shape_to_iree(
            (config.B, config.N_KV, config.H_KV, config.D_Q),
            in_dtype,
            self.device_ctx,
        )
        value_shape = shape_to_iree(
            (config.B, config.N_KV, config.H_KV, config.D_KV),
            in_dtype,
            self.device_ctx,
        )
        output_shape = shape_to_iree(
            (config.B, config.N_Q, config.H, config.D_KV), out_dtype, self.device_ctx
        )

        runtime_args = [
            f"--input={shape}"
            for shape in [query_shape, key_shape, value_shape, output_shape]
        ]
        runtime_args += ["--function=isolated_benchmark"]
        return runtime_args
