"""Fraud Alert: finds unusual accounts/orders with an Isolation Forest.

IMPORTANT: there is no real fraud data, so the training data is SIMULATED.
Results show the pipeline works. They do not prove real-world accuracy.

Train it once:   python -m fraud_alert.core
"""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.metrics import confusion_matrix, precision_score, recall_score
from sklearn.model_selection import train_test_split

FEATURES = ['account_age_days', 'orders_per_day', 'avg_price_bdt',
            'failed_payments', 'same_address_orders']
MODEL_FILE = Path(__file__).resolve().parent / 'fraud_model.joblib'
_bundle = None


def make_dataset(n_normal=950, n_fraud=50, seed=42):
    """Make simulated data: normal orders and fraud (40% of fraud is 'mild' and hard to see)."""
    rng = np.random.default_rng(seed)
    normal = pd.DataFrame({
        'account_age_days': rng.integers(0, 400, n_normal),  # some honest customers are new too
        'orders_per_day': rng.poisson(0.4, n_normal),
        'avg_price_bdt': rng.lognormal(7.5, 0.6, n_normal).round(),
        'failed_payments': rng.poisson(0.3, n_normal),
        'same_address_orders': rng.poisson(0.2, n_normal),
        'is_fraud': 0,
    })
    fraud = pd.DataFrame({
        'account_age_days': rng.integers(0, 3, n_fraud),
        'orders_per_day': rng.integers(5, 15, n_fraud),
        'avg_price_bdt': rng.lognormal(9.0, 0.5, n_fraud).round(),
        'failed_payments': rng.integers(3, 10, n_fraud),
        'same_address_orders': rng.integers(3, 8, n_fraud),
        'is_fraud': 1,
    })
    # 40% of fraud is 'mild': it looks almost like a normal customer (this makes the test fair, not too easy)
    mild = rng.random(n_fraud) < 0.4
    k = int(mild.sum())
    fraud.loc[mild, 'orders_per_day'] = rng.integers(1, 4, k)
    fraud.loc[mild, 'failed_payments'] = rng.integers(0, 3, k)
    fraud.loc[mild, 'account_age_days'] = rng.integers(3, 60, k)
    fraud.loc[mild, 'avg_price_bdt'] = rng.lognormal(7.8, 0.6, k).round()
    fraud.loc[mild, 'same_address_orders'] = rng.integers(0, 4, k)
    return pd.concat([normal, fraud]).sample(frac=1, random_state=1).reset_index(drop=True)


def train():
    df = make_dataset()
    X, y = df[FEATURES], df['is_fraud']
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, stratify=y, random_state=42)

    model = IsolationForest(n_estimators=200, contamination=0.05, random_state=42)
    model.fit(X_train)  # unsupervised: labels are NOT used for training

    pred = (model.predict(X_test) == -1).astype(int)
    print('--- Test results (simulated data) ---')
    print('Test rows:', len(y_test), '| fraud rows:', int(y_test.sum()))
    print('Precision:', round(precision_score(y_test, pred, zero_division=0), 3))
    print('Recall   :', round(recall_score(y_test, pred, zero_division=0), 3))
    print('Confusion matrix [[TN, FP], [FN, TP]]:')
    print(confusion_matrix(y_test, pred))

    s = -model.score_samples(X_train)
    lo, hi = float(np.percentile(s, 50)), float(np.percentile(s, 99))
    threshold = float(-model.offset_)
    joblib.dump({'model': model, 'lo': lo, 'hi': hi, 'threshold': threshold}, MODEL_FILE)
    print('Model saved to:', MODEL_FILE)


def _load():
    global _bundle
    if _bundle is None:
        if not MODEL_FILE.exists():
            raise FileNotFoundError('Model not trained yet. Run: python -m fraud_alert.core')
        _bundle = joblib.load(MODEL_FILE)
    return _bundle


def risk_score(features):
    """features: dict with the 5 FEATURES. Returns risk (0-100), flagged (True/False), reasons."""
    b = _load()
    row = pd.DataFrame([[float(features[k]) for k in FEATURES]], columns=FEATURES)
    s = float(-b['model'].score_samples(row)[0])
    risk = float(np.clip((s - b['lo']) / (b['hi'] - b['lo']), 0, 1) * 100)
    flagged = s >= b['threshold']

    reasons = []
    if features['account_age_days'] <= 3:
        reasons.append(f"Very new account ({int(features['account_age_days'])} days old)")
    if features['orders_per_day'] >= 4:
        reasons.append(f"Many orders in one day ({int(features['orders_per_day'])})")
    if features['failed_payments'] >= 3:
        reasons.append(f"Many failed payments ({int(features['failed_payments'])})")
    if features['same_address_orders'] >= 3:
        reasons.append(f"Many orders to the same address ({int(features['same_address_orders'])})")
    if features['avg_price_bdt'] >= 15000:
        reasons.append('Unusually high average price')
    if flagged and not reasons:
        reasons.append('Unusual combination of activity')

    return {'risk_score': round(risk, 1), 'flagged': bool(flagged), 'reasons': reasons}


if __name__ == '__main__':
    train()