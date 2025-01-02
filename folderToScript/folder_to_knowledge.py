import os

def build_knowledge_base(root_dir, output_file='full-jonas-mach-weird.txt'):
    with open(output_file, 'w', encoding='utf-8') as kb:
        for foldername, subfolders, filenames in os.walk(root_dir):
            kb.write(f"This is the folder: {foldername}\n")
            for filename in filenames:
                file_path = os.path.join(foldername, filename)
                # Skip non-code files if needed
                if not filename.lower().endswith(('.py', '.vue', '.js', '.jsx', '.py3')):
                    continue
                kb.write(f"This is the file: {file_path}\n")
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                        kb.write(content)
                except Exception as e:
                    kb.write(f"Error reading {file_path}: {e}\n")

# Replace 'path_to_your_folder' with the actual directory path
build_knowledge_base(os.path.expanduser('~/ai-plans/machiavelli'))
