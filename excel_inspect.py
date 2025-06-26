import pandas as pd
import re
from pathlib import Path

def get_sheet_choice():
    """Get and validate user input for sheet selection."""
    print("\nAvailable sheets to analyze:")
    print("1) Active")
    print("2) Graduate")
    print("3) Withdraw")
    
    while True:
        choice = input("\nEnter sheet number (1-3): ").strip()
        if choice in ['1', '2', '3']:
            return {
                '1': {'name': 'Active', 'required': ['F', 'G', 'M']},
                '2': {'name': 'Graduate', 'required': ['C', 'M']},
                '3': {'name': 'Withdraw', 'required': ['C', 'M']}
            }[choice]
        print("Invalid input. Please try again")

def process_sheet(file_path, sheet_info):
    """Process the selected sheet with specific rules."""
    sheet_name = sheet_info['name']
    required_col_letters = sheet_info['required']  # ['F', 'G', 'M'] etc.
    
    try:
        # Read Excel with first row as headers
        df = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
        
        # Convert column letters to indices (A=0, B=1, ..., Z=25)
        required_col_indices = [ord(col.upper()) - 65 for col in required_col_letters]
        
        # Verify required columns exist
        if len(df.columns) <= max(required_col_indices):
            missing_cols = [chr(65 + idx) for idx in required_col_indices 
                          if len(df.columns) <= idx]
            print(f"❌ Missing required columns: {missing_cols}")
            return None
        
        # Filter rows where required columns are not null
        filter_condition = df.iloc[:, required_col_indices].notna().all(axis=1)
        filtered_df = df[filter_condition].copy()
        
        # Try to find DI column (case-insensitive)
        di_col = None
        for i, col in enumerate(df.columns):
            if isinstance(col, str) and re.fullmatch(r'(?i)DI', col.strip()):
                di_col = i
                break
        
        if di_col is not None:
            cols_to_keep = df.columns[:di_col+1]
            filtered_df = filtered_df[cols_to_keep]
            print(f"Showing columns up to: DI (column {di_col+1})")
        else:
            print("⚠️ DI column not found, showing all columns")
        
        # Add column letters to output headers
        filtered_df.columns = [
            f"{col} (Col_{chr(65+i)})" if not str(col).startswith('Unnamed') 
            else f"Col_{chr(65+i)}"
            for i, col in enumerate(filtered_df.columns)
        ]
        
        print(f"\nTotal records: {len(df)}")
        print(f"Valid records: {len(filtered_df)}")
        
        if not filtered_df.empty:
            print("\nFirst valid record:")
            print(filtered_df.iloc[0].to_dict())
            
            # Save to CSV with sheet-specific name
            output_file = f"{Path(file_path).stem}_{sheet_name}_filtered.csv"
            filtered_df.to_csv(output_file, index=False, encoding='utf-8-sig')
            print(f"\n✅ Saved {len(filtered_df)} records to {output_file}")
            return filtered_df
        else:
            print("\n❌ No valid records found matching criteria")
            return None
            
    except Exception as e:
        print(f"\n❌ Error processing {sheet_name} sheet: {str(e)}")
        return None

def main():
    print("=== Excel Data Inspector ===")
    
    # Find Excel files in current directory
    excel_files = list(Path('.').glob('*.xls*'))
    if not excel_files:
        print("❌ No Excel files found in current directory")
        return
    
    print("\nAvailable Excel files:")
    for i, file in enumerate(excel_files, 1):
        print(f"{i}) {file.name}")
    
    # Let user select file
    while True:
        try:
            file_choice = int(input("\nSelect file number: ")) - 1
            if 0 <= file_choice < len(excel_files):
                excel_file = excel_files[file_choice]
                break
            print(f"Please enter number between 1-{len(excel_files)}")
        except ValueError:
            print("Invalid input. Please enter a number")
    
    # Let user select sheet
    sheet_info = get_sheet_choice()
    
    # Process selected sheet
    process_sheet(excel_file, sheet_info)

if __name__ == "__main__":
    main()