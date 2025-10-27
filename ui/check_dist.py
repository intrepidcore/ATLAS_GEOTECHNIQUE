with open('dist/index.html', 'r', encoding='utf-8') as f:
    content = f.read()
    
if 'appVersion' in content:
    print("✅ appVersion trouvé dans dist/index.html")
else:
    print("❌ appVersion NON trouvé dans dist/index.html")
    
if 'v1.3.0' in content:
    print("⚠️  v1.3.0 hardcodé trouvé")
    
if 'v1.6.0' in content:
    print("✅ v1.6.0 trouvé")

# Chercher la ligne avec la version
for line in content.split('\n'):
    if 'Atlas Géotechnique' in line and ('v1.' in line or 'appVersion' in line):
        print(f"\nLigne trouvée: {line.strip()}")
