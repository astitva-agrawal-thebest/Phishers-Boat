import csv
import json
import os

def train():
    dataset_path = 'dataset/dataset.csv'
    output_path = 'background/model_weights.json'
    
    print(f"Loading dataset from {dataset_path}...")
    
    with open(dataset_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        
        target = 'Result'
        if target not in fields:
            # Fallback if different casing
            target = [f for f in fields if 'result' in f.lower()][0]
            
        features = [f for f in fields if f != target and f != 'index' and f != 'id']
        
        # Initialize weights and counts
        weights = {feat: 0.0 for feat in features}
        
        row_count = 0
        for row in reader:
            try:
                y = float(row[target])
                # In this Kaggle dataset, usually 1 is phishing, -1 is legitimate (or vice versa).
                # Let's map it so positive weight means phishing. 
                # Assuming Result=1 means phishing and -1 means legit.
                y_val = 1.0 if y > 0 else -1.0
                
                for feat in features:
                    val = float(row[feat])
                    # Update weight: if a feature is 1 when phishing, it increases weight.
                    weights[feat] += (y_val * val)
                row_count += 1
            except ValueError:
                continue
                
    print(f"Processed {row_count} records.")
    
    # Normalize weights so they fit nicely between -1 and 1
    max_w = max(abs(w) for w in weights.values()) if weights else 1.0
    for feat in weights:
        weights[feat] = weights[feat] / max_w
        
    # We will output a small JSON file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(weights, f, indent=2)
        
    print(f"SUCCESS! Local model trained using Pure Math.")
    print(f"Weights saved to {output_path}")

if __name__ == '__main__':
    train()
