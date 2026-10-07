import re

with open('src/utils/security/engine.ts', 'r') as f:
    text = f.read()

def replacer(m):
    obj_content = m.group(1)
    
    # We figure out which res we are talking about based on the risk and description
    res_var = "baselineRes"
    headers_var = "resolvedBase.headers"
    body_var = "resolvedBase.body"
    
    if "bola-1" in obj_content or "bola-pass" in obj_content:
        res_var = "bolaRes"
        headers_var = "bolaHeaders"
    elif "auth-1" in obj_content or "auth-pass" in obj_content:
        res_var = "noAuthRes"
        headers_var = "noAuthHeaders"
    elif "sql-1" in obj_content or "sql-pass" in obj_content:
        res_var = "sqliRes"
        headers_var = "resolvedBase.headers"
        # in SQLi it sends body directly
        body_var = "undefined" 
    elif "xss-1" in obj_content or "xss-pass" in obj_content:
        res_var = "xssRes"
        headers_var = "resolvedBase.headers"
        body_var = "undefined"
    elif "baseline-fail" in obj_content:
        res_var = "baselineRes"
        headers_var = "resolvedBase.headers"
        body_var = "resolvedBase.body"

    injection = f"requestHeaders: {headers_var}, requestBody: {body_var}, responseHeaders: {res_var}.headers, responseBody: {res_var}.body, statusCode: {res_var}.status, responseTime: {res_var}.duration"
    
    # Strip any trailing comma from obj_content
    obj_content = obj_content.rstrip().rstrip(',')
    
    return f"findings.push({{{obj_content}, {injection}}});"

new_text = re.sub(r'findings\.push\(\{(.*?)\}\);', replacer, text, flags=re.DOTALL)

with open('src/utils/security/engine.ts', 'w') as f:
    f.write(new_text)
