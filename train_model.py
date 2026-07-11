"""
AI Phishing Defense - Local Model Training Script
This script downloads the 'akashkr/phishing-website-dataset' from Kaggle,
trains a Random Forest classifier, and exports the model to ONNX format
so it can be run directly inside the Chrome Extension using onnxruntime-web.

Dependencies needed:
pip install kagglehub pandas scikit-learn skl2onnx onnx
"""

import os
import kagglehub
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

def main():
    print("1. Downloading dataset from Kaggle...")
    try:
        # Download the dataset using kagglehub
        path = kagglehub.dataset_download('akashkr/phishing-website-dataset')
        print(f"Dataset downloaded to: {path}")
        
        # Find the CSV file in the downloaded directory
        files = [f for f in os.listdir(path) if f.endswith('.csv')]
        if not files:
            raise FileNotFoundError("No CSV file found in the downloaded dataset.")
            
        csv_path = os.path.join(path, files[0])
        print(f"Loading data from {csv_path}...")
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"Failed to download or load dataset: {e}")
        return

    print(f"\nDataset loaded. Shape: {df.shape}")
    
    # 2. Preprocess Data
    # Assuming the target column is something like 'Result' or 'phishing'
    # We will find the target column based on typical Kaggle dataset structures.
    target_cols = [c for c in df.columns if 'result' in c.lower() or 'class' in c.lower() or 'phishing' in c.lower()]
    
    if not target_cols:
        print("Could not automatically identify the target column. Please specify it manually.")
        print("Columns available:", df.columns.tolist())
        return
        
    target_col = target_cols[0]
    print(f"Identified target column: '{target_col}'")
    
    # Separate features (X) and target (y)
    X = df.drop(columns=[target_col])
    y = df[target_col]
    
    # Convert string targets to numeric if necessary (e.g. 'Phishing' -> 1, 'Legitimate' -> 0)
    if y.dtype == 'object':
        y = y.astype('category').cat.codes
        
    # Drop any non-numeric columns for simplicity in this baseline model
    X = X.select_dtypes(include=['number'])
    
    # Fill NaN values
    X = X.fillna(0)
    
    # Ensure all inputs are float32 for ONNX compatibility
    X = X.astype('float32')

    # Split into training and testing sets
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    print(f"\n2. Training Random Forest Classifier with {X.shape[1]} features...")
    # Train a lightweight Random Forest model
    clf = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
    clf.fit(X_train, y_train)

    # 3. Evaluate the model
    print("\n3. Evaluating Model...")
    y_pred = clf.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Accuracy: {acc * 100:.2f}%")
    print("Classification Report:")
    print(classification_report(y_test, y_pred))

    # 4. Export to ONNX
    print("\n4. Exporting model to ONNX format...")
    # Define the input type and shape for the ONNX model (None means dynamic batch size)
    initial_type = [('float_input', FloatTensorType([None, X.shape[1]]))]
    
    try:
        onx = convert_sklearn(clf, initial_types=initial_type, target_opset=12)
        
        # Save the model to the extension's background folder
        output_path = os.path.join(os.path.dirname(__file__), 'background', 'phishing_model.onnx')
        
        # Ensure directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, "wb") as f:
            f.write(onx.SerializeToString())
            
        print(f"\nSUCCESS! Model exported to: {output_path}")
        print("You can now load this model in your Chrome Extension using onnxruntime-web.")
        
    except ImportError:
        print("Failed to export. Please ensure 'skl2onnx' is installed: pip install skl2onnx")

if __name__ == "__main__":
    main()
