from app.ml_feedback import train_feedback_model


if __name__ == "__main__":
    metrics = train_feedback_model()

    print("Training complete")
    print(f"Dataset: {metrics['dataset_path']}")
    print(f"Rows: {metrics['rows']}")
    print("MAE:")
    print(f"  confidence: {metrics['mae']['confidence']}")
    print(f"  grammar: {metrics['mae']['grammar']}")
    print(f"  technical: {metrics['mae']['technical']}")
