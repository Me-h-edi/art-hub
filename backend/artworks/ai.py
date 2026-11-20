"""CLIP-based AI helpers for Art-Hub (image embedding, text embedding, similarity)."""
import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

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