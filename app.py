from flask import Flask, render_template, request, send_file, session, jsonify
from services.processar_planilha import carregar_planilha
import pandas as pd
import numpy as np
import os
import uuid
import json
import math
from io import BytesIO
import zipfile

app = Flask(__name__)
app.secret_key = ''

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ─────────────────────────────────────────────────────────────
#  SOLUÇÃO ALTERNATIVA: Tratamento centralizado de dados
# ─────────────────────────────────────────────────────────────

def get_session_id():
    if 'uid' not in session:
        session['uid'] = str(uuid.uuid4())
    return session['uid']

def preparar_para_json(obj):
    """
    Converte recursivamente objetos para formatos compatíveis com JSON puro.
    Substitui NaN por None (que vira null no JSON).
    """
    if isinstance(obj, dict):
        return {k: preparar_para_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [preparar_para_json(i) for i in obj]
    elif isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
    return obj

@app.route("/", methods=["GET", "POST"])
def home():
    colunas = []
    erro = None
    uid = get_session_id()
    total_linhas = 0

    if request.method == "POST":
        file = request.files.get("file")
        if file:
            try:
                df = carregar_planilha(file)
                # Normaliza nomes de colunas para evitar conflitos no JSON
                df.columns = [str(c) if pd.notnull(c) else f"Coluna_{i+1}" for i, c in enumerate(df.columns)]
                
                df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl"))
                df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl"))

                colunas = df.columns.tolist()
                total_linhas = len(df)
            except Exception as e:
                erro = str(e)

    return render_template("index.html",
                           colunas=colunas,
                           erro=erro,
                           colunas_escolhidas=colunas,
                           sugestoes=[],
                           total_linhas=total_linhas)

@app.route("/dados", methods=["GET"])
def dados():
    uid = get_session_id()
    filtrado_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")

    if not os.path.exists(filtrado_path):
        return jsonify({"draw": 0, "recordsTotal": 0, "recordsFiltered": 0, "data": []})

    draw = int(request.args.get("draw", 1))
    start = int(request.args.get("start", 0))
    length = int(request.args.get("length", 50))
    search_value = request.args.get("search[value]", "").strip()

    df = pd.read_pickle(filtrado_path)
    records_total = len(df)

    if search_value:
        mask = df.apply(lambda col: col.astype(str).str.contains(search_value, case=False, na=False)).any(axis=1)
        df = df[mask]

    records_filtered = len(df)

    order_col_idx = request.args.get("order[0][column]", None)
    if order_col_idx is not None:
        try:
            col_name = df.columns[int(order_col_idx)]
            ascending = (request.args.get("order[0][dir]", "asc") == "asc")
            df = df.sort_values(by=col_name, ascending=ascending)
        except: pass

    df_page = df.iloc[start: start + length]
    
    # Converte tudo para tipos básicos do Python (substitui NaNs por None)
    # Isso evita o erro de "Unexpected token N in JSON" no frontend
    raw_data = df_page.values.tolist()
    sanitized_data = []
    for idx, row in zip(df_page.index, raw_data):
        # O primeiro item é o índice original
        clean_row = [int(idx)] + [v if pd.notnull(v) else None for v in row]
        sanitized_data.append(clean_row)

    return jsonify({
        "draw": draw,
        "recordsTotal": int(records_total),
        "recordsFiltered": int(records_filtered),
        "data": sanitized_data
    })

@app.route("/upload", methods=["POST"])
def upload():
    uid = get_session_id()
    file = request.files.get("file")
    if not file: return jsonify({"status": "error", "message": "Nenhum arquivo"}), 400

    try:
        df = carregar_planilha(file)
        df.columns = [str(c) if pd.notnull(c) else f"Coluna_{i+1}" for i, c in enumerate(df.columns)]
        df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl"))
        df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl"))

        return jsonify({
            "status": "ok",
            "colunas": df.columns.tolist(),
            "total_linhas": int(len(df))
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/filtrar", methods=["POST"])
def filtrar():
    uid = get_session_id()
    df_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl")
    if not os.path.exists(df_path): return jsonify({"status": "error"}), 400

    df = pd.read_pickle(df_path)

    # Coleta parâmetros
    colunas_escolhidas = request.form.getlist("colunas") or df.columns.tolist()
    termo_busca = request.form.get("busca", "").strip()
    remover_duplicados = request.form.get("remover_duplicados")
    col_dups = request.form.get("coluna_duplicados")
    remover_chars = request.form.get("remover_caracteres")
    col_limpar = request.form.get("coluna_limpar")

    # 1. Filtra colunas
    df_f = df[colunas_escolhidas].copy()

    # 2. Limpeza
    if remover_chars:
        patt = r'[()\-\s\.]+'
        cols_to_clean = df_f.select_dtypes(include=['object', 'string']).columns if col_limpar == "TODAS" else ([col_limpar] if col_limpar in df_f.columns else [])
        for c in cols_to_clean:
            df_f[c] = df_f[c].astype(str).str.replace(patt, '', regex=True)

    # 3. Busca
    if termo_busca:
        mask = df_f.apply(lambda c: c.astype(str).str.contains(termo_busca, case=False, na=False, regex=False)).any(axis=1)
        df_f = df_f[mask]

    # 4. Duplicados
    dups_count = 0
    if remover_duplicados:
        antes = len(df_f)
        subset = [col_dups] if (col_dups and col_dups in df_f.columns) else None
        df_f = df_f.drop_duplicates(subset=subset)
        dups_count = antes - len(df_f)

    # 5. Salva cache
    df_f.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl"))

    # 6. Sugestões (Seguro para JSON)
    sugestoes = []
    if not df_f.empty:
        sugestoes = [str(x) for x in df_f.head(500).astype(str).stack().unique() if pd.notnull(x) and str(x).lower() != 'nan'][:50]

    return jsonify(preparar_para_json({
        "status": "ok",
        "colunas_escolhidas": colunas_escolhidas,
        "total_filtrado": int(len(df_f)),
        "duplicados_removidos": int(dups_count),
        "sugestoes": sugestoes
    }))

@app.route("/editar_celula", methods=["POST"])
def editar_celula():
    uid = get_session_id()
    df_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl")
    if not os.path.exists(df_path): return {"status": "error"}, 400

    row_id = request.form.get("row_id")
    col_name = request.form.get("col_name")
    new_val = request.form.get("new_value")

    try:
        row_id = int(row_id)
        df = pd.read_pickle(df_path)
        if row_id in df.index and col_name in df.columns:
            df.at[row_id, col_name] = new_val
            df.to_pickle(df_path)
            
            # Atualiza também o filtrado para consistência imediata
            f_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")
            if os.path.exists(f_path):
                df_f = pd.read_pickle(f_path)
                if row_id in df_f.index and col_name in df_f.columns:
                    df_f.at[row_id, col_name] = new_val
                    df_f.to_pickle(f_path)
        return {"status": "success"}
    except:
        return {"status": "error"}, 400

@app.route("/baixar", methods=["GET", "POST"])
def baixar():
    uid = get_session_id()
    f_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")
    if not os.path.exists(f_path): return "Erro", 400
    df_f = pd.read_pickle(f_path)
    
    output = BytesIO()
    df_f.to_excel(output, index=False, engine="openpyxl")
    output.seek(0)
    return send_file(output, download_name="dados.xlsx", as_attachment=True)

@app.route("/dividir_baixar", methods=["POST"])
def dividir_baixar():
    uid = get_session_id()
    f_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")
    if not os.path.exists(f_path): return "Erro", 400
    df_f = pd.read_pickle(f_path)
    
    parts = int(request.form.get("num_parts", 3))
    size = math.ceil(len(df_f) / parts)
    
    memory_file = BytesIO()
    with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i in range(parts):
            chunk = df_f.iloc[i*size : (i+1)*size]
            if chunk.empty: break
            buf = BytesIO()
            chunk.to_csv(buf, index=False, encoding='utf-8-sig', sep=';')
            zf.writestr(f"parte_{i+1}.csv", buf.getvalue())
    memory_file.seek(0)
    return send_file(memory_file, download_name="dividido.zip", as_attachment=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
