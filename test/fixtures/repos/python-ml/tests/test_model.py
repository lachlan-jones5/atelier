"""Tests for the ML model."""

import pytest
import torch
from src.model import SimpleNet


def test_model_output_shape():
    model = SimpleNet(input_dim=784, output_dim=10)
    x = torch.randn(32, 784)
    out = model(x)
    assert out.shape == (32, 10)


def test_model_forward_no_errors():
    model = SimpleNet()
    x = torch.randn(1, 784)
    # Should not raise
    _ = model(x)


def test_model_custom_dims():
    model = SimpleNet(input_dim=256, hidden_dim=64, output_dim=5)
    x = torch.randn(8, 256)
    out = model(x)
    assert out.shape == (8, 5)
