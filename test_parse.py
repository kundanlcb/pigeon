import re

with open('src/components/RunnerView.tsx', 'r') as f:
    text = f.read()

# very basic jsx tag counter, ignores strings for simplicity
tags = []
for m in re.finditer(r'<(/)?([A-Za-z0-9_]+)([^>]*?)(/?)>', text):
    is_close = m.group(1) == '/'
    tag = m.group(2)
    is_self_close = m.group(4) == '/'
    if tag in ['input', 'br', 'hr']: continue
    if not is_close and not is_self_close:
        tags.append((tag, m.start()))
    elif is_close:
        if tags and tags[-1][0] == tag:
            tags.pop()
        else:
            print(f'Mismatched closing tag {tag} at index {m.start()}, expected {tags[-1][0] if tags else "None"}')

print("Remaining tags:")
for t in tags:
    print(t)
