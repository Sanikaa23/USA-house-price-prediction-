# app.py
from flask import Flask, send_from_directory, jsonify, request, make_response
from flask_cors import CORS
import os
import csv
import io
import json
import pandas as pd
from sklearn.linear_model import LinearRegression   ✅
import traceback

app = Flask(__name__, static_folder='.', static_url_path='/')
CORS(app)

# Paths the app will try to load as dataset
POSSIBLE_CSV = [
    os.path.join('data', 'housing.csv'),
    'housing.csv',
    'dataset.csv'
]

# Simple cached model and data
DATA_DF = None
MODEL = None
MODEL_FEATURES = ['income', 'rooms', 'age']  # used by predict endpoint

def load_dataset():
    global DATA_DF
    # if dataset already loaded, return
    if DATA_DF is not None:
        return DATA_DF

    for p in POSSIBLE_CSV:
        if os.path.exists(p):
            try:
                df = pd.read_csv(p)
                DATA_DF = df
                print(f"Loaded dataset from {p} ({len(df)} rows).")
                return DATA_DF
            except Exception as e:
                print("Failed to read", p, e)
    # fallback small dataset
    fallback = pd.DataFrame([
        {'region':'Indiana', 'income':40000, 'price':120000, 'age':12, 'rooms':3},
        {'region':'Ohio', 'income':50000, 'price':180000, 'age':10, 'rooms':4},
        {'region':'Texas', 'income':60000, 'price':250000, 'age':8, 'rooms':4},
        {'region':'Florida', 'income':70000, 'price':300000, 'age':6, 'rooms':5},
        {'region':'California', 'income':80000, 'price':450000, 'age':4, 'rooms':6},
        {'region':'New York', 'income':90000, 'price':600000, 'age':3, 'rooms':7},
        {'region':'Washington', 'income':100000, 'price':750000, 'age':2, 'rooms':8},
    ])
    DATA_DF = fallback
    print("Using fallback dataset.")
    return DATA_DF

def train_model_if_needed():
    global MODEL
    if MODEL is not None:
        return MODEL
    df = load_dataset()
    # ensure required columns exist
    for c in MODEL_FEATURES + ['price']:
        if c not in df.columns:
            print("Train skipped: missing column", c)
            return None
    try:
        X = df[MODEL_FEATURES].fillna(0)
        y = df['price'].fillna(0)
        model = LinearRegression()
        model.fit(X, y)
        MODEL = model
        print("Trained linear regression model.")
        return MODEL
    except Exception as e:
        print("Model training failed:", e)
        traceback.print_exc()
        return None

def df_to_list_of_dict(df):
    out = []
    for _, row in df.iterrows():
        out.append({
            'region': str(row.get('region', 'Unknown')),
            'income': float(row.get('income', 0) or 0),
            'price': float(row.get('price', 0) or 0),
            'age': float(row.get('age', 0) or 0),
            'rooms': int(row.get('rooms', 0) or 0)
        })
    return out

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_any(path):
    # static files
    if os.path.exists(path):
        return send_from_directory('.', path)
    return send_from_directory('.', path)

@app.route('/api/housing')
def api_housing():
    df = load_dataset()
    return jsonify(df_to_list_of_dict(df))

@app.route('/api/predict', methods=['POST'])
def api_predict():
    try:
        payload = request.get_json() or {}
        income = float(payload.get('income', 0))
        rooms = int(payload.get('rooms', 0))
        age = int(payload.get('age', 0))

        model = train_model_if_needed()
        if model is not None:
            X = [[income, rooms, age]]
            pred = model.predict(X)[0]
            # compute simple contribution using coefficients (approx explain)
            coefs = dict(zip(MODEL_FEATURES, list(model.coef_)))
            intercept = float(model.intercept_)
            contributions = {k: coefs.get(k, 0) * v for k, v in zip(MODEL_FEATURES, [income, rooms, age])}
            return jsonify({'predicted_price': float(pred), 'model': 'linear_regression', 'coefficients': coefs, 'intercept': intercept, 'contributions': contributions})
        else:
            # fallback heuristic
            base = 50000
            pred = base + income * 2.5 + rooms * 20000 - age * 1000
            return jsonify({'predicted_price': float(pred), 'model': 'heuristic'})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

@app.route('/api/export')
def api_export():
    """
    Exports a CSV of the current filtered dataset.
    Accepts same query params as the client filters: region, minPrice, maxPrice, minRooms, maxRooms, minAge, maxAge
    If none provided, exports entire dataset.
    """
    try:
        df = load_dataset().copy()
        # apply filters if present
        region = request.args.get('region')
        if region:
            df = df[df['region'].astype(str) == region]
        try:
            minPrice = request.args.get('minPrice', type=float)
            maxPrice = request.args.get('maxPrice', type=float)
        except:
            minPrice = maxPrice = None
        if minPrice is not None:
            df = df[df['price'].astype(float) >= minPrice]
        if maxPrice is not None:
            df = df[df['price'].astype(float) <= maxPrice]
        try:
            minRooms = request.args.get('minRooms', type=int)
            maxRooms = request.args.get('maxRooms', type=int)
        except:
            minRooms = maxRooms = None
        if minRooms is not None:
            df = df[df['rooms'].astype(int) >= minRooms]
        if maxRooms is not None:
            df = df[df['rooms'].astype(int) <= maxRooms]
        # convert df to csv stream
        si = io.StringIO()
        df.to_csv(si, index=False)
        output = make_response(si.getvalue())
        output.headers["Content-Disposition"] = "attachment; filename=housing_export.csv"
        output.headers["Content-type"] = "text/csv"
        return output
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/explain', methods=['POST'])
def api_explain():
    """
    Return per-feature contributions for an input (income, rooms, age).
    If linear model exists, use coefficients; otherwise return heuristic contributions.
    """
    try:
        payload = request.get_json() or {}
        income = float(payload.get('income', 0))
        rooms = int(payload.get('rooms', 0))
        age = int(payload.get('age', 0))
        model = train_model_if_needed()
        if model is not None:
            coefs = dict(zip(MODEL_FEATURES, list(model.coef_)))
            intercept = float(model.intercept_)
            contributions = {k: float(coefs[k] * v) for k, v in zip(MODEL_FEATURES, [income, rooms, age])}
            return jsonify({'model': 'linear_regression', 'intercept': intercept, 'coefficients': coefs, 'contributions': contributions})
        else:
            # heuristic contributions (example scale)
            contributions = {
                'income': income * 2.5,
                'rooms': rooms * 20000,
                'age': -age * 1000
            }
            return jsonify({'model': 'heuristic', 'intercept': 50000, 'contributions': contributions})
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    # ensure model attempts to train at startup (not required)
    try:
        train_model_if_needed()
    except:
        pass
    app.run(host='0.0.0.0', port=5000, debug=True)
