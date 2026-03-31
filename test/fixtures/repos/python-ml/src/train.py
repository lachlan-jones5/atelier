"""Training script for the ML model."""

import torch
from model import SimpleNet


def train(epochs: int = 10, lr: float = 0.001) -> dict:
    """Train the model and return metrics."""
    model = SimpleNet()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = torch.nn.CrossEntropyLoss()

    # TODO: load dataset
    # TODO: training loop
    # TODO: return training metrics

    return {"epochs": epochs, "final_loss": 0.0}


if __name__ == "__main__":
    metrics = train()
    print(f"Training complete: {metrics}")
