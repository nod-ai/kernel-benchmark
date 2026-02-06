from kernel_bench.config.types.attention.bshd_attention_config import (
    AttentionConfigBSHD,
)


def custom_fa_problems() -> list[tuple[str, AttentionConfigBSHD]]:
    """Custom Flash Attention configuration matching: -d 128 -hq 64 -b 1 -sq 16384 -causal 0 -layout bshd"""
    configs = []
    
    # Exact match for original test case
    configs.append(("fa_16k_h64_d128", AttentionConfigBSHD(
        B=1,           # -b 1
        H=64,          # -hq 64
        H_KV=64,       # MHA (not GQA)
        N_Q=16384,     # -sq 16384
        N_KV=16384,    # -sq 16384
        D_Q=128,       # -d 128
        D_KV=128,      # -d 128
        dtype="f16",
        causal=False,  # -causal 0
    )))
    
    return configs


def get_bshd_attention_configs() -> list[tuple[str, AttentionConfigBSHD]]:
    """Returns all BSHD attention configurations for benchmarking"""
    configs = []
    configs += custom_fa_problems()
    return configs
