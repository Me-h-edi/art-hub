"""AI helpers for Art-Hub: CLIP embeddings & EfficientNet-B0 Artwork Classifier."""
import json
from pathlib import Path
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from transformers import CLIPModel, CLIPProcessor

# ==========================================
# 1. CLIP-based Embeddings & Similarity
# ==========================================
MODEL_NAME = "openai/clip-vit-base-patch32"
_model = None
_processor = None


def _load():
    global _model, _processor
    if _model is None:
        _model = CLIPModel.from_pretrained(MODEL_NAME)
        _processor = CLIPProcessor.from_pretrained(MODEL_NAME)
        _model.eval()
    return _model, _processor


def _to_tensor(out):
    """Newer transformers versions may return an object instead of a plain tensor."""
    if isinstance(out, torch.Tensor):
        return out
    for name in ("pooler_output", "image_embeds", "text_embeds"):
        value = getattr(out, name, None)
        if value is not None:
            return value
    return out[0]


def _normalize(t):
    return t / t.norm(dim=-1, keepdim=True)


def embed_image(file_or_path):
    model, processor = _load()
    image = Image.open(file_or_path).convert("RGB")
    with torch.no_grad():
        feats = _to_tensor(model.get_image_features(**processor(images=image, return_tensors="pt")))
    return _normalize(feats)[0].tolist()


def embed_text(text):
    model, processor = _load()
    with torch.no_grad():
        feats = _to_tensor(model.get_text_features(**processor(text=[text], return_tensors="pt", padding=True)))
    return _normalize(feats)[0].tolist()


def cosine(a, b):
    return float(np.dot(np.array(a), np.array(b)))


# ==========================================
# 2. Custom EfficientNet-B0 Artwork Classifier
# ==========================================
BASE_DIR = Path(__file__).resolve().parent
CLS_MODEL_PATH = BASE_DIR / "ml_models" / "art_hub_efficientnet.pth"
CLS_LABELS_PATH = BASE_DIR / "ml_models" / "class_names.json"

_cls_model = None
_cls_labels = None

_cls_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])


def _load_classifier():
    global _cls_model, _cls_labels
    if _cls_model is None:
        with open(CLS_LABELS_PATH, "r", encoding="utf-8") as f:
            _cls_labels = json.load(f)

        model = models.efficientnet_b0(weights=None)
        model.classifier[1] = nn.Linear(model.classifier[1].in_features, len(_cls_labels))
        state_dict = torch.load(CLS_MODEL_PATH, map_location=torch.device("cpu"))
        model.load_state_dict(state_dict)
        model.eval()
        _cls_model = model

    return _cls_model, _cls_labels


def classify_artwork(file_or_path):
    """
    Predicts the artwork medium/category using the trained EfficientNet-B0 model.
    Returns dict: {"category": str, "confidence": float, "scores": dict}
    """
    model, labels = _load_classifier()

    if hasattr(file_or_path, "seek"):
        file_or_path.seek(0)

    image = Image.open(file_or_path).convert("RGB")
    tensor = _cls_transform(image).unsqueeze(0)

    with torch.no_grad():
        logits = model(tensor)
        probs = torch.softmax(logits, dim=1)[0]

    if hasattr(file_or_path, "seek"):
        file_or_path.seek(0)

    top_idx = int(torch.argmax(probs).item())
    scores = {
        labels[i]: round(float(probs[i].item()) * 100, 2)
        for i in range(len(labels))
    }

    return {
        "category": labels[top_idx],
        "confidence": scores[labels[top_idx]],
        "scores": scores,
    }