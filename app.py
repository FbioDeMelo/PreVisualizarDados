from flask import Flask, render_template, request, send_file, session
from services.processar_planilha import carregar_planilha
import pandas as pd
import os
import uuid
from io import BytesIO

app = Flask(__name__)
app.secret_key = 'super_secret_key_teste_csv' # Imprescindivel para usar session['key']

UPLOAD_FOLDER = os.path.join(os.getcwd(), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_session_id():
    """Garante que cada usuário possui um ID único gravado em seu cookie."""
    if 'uid' not in session:
        session['uid'] = str(uuid.uuid4())
    return session['uid']

@app.route("/", methods=["GET", "POST"])
def home():
    colunas = []
    dados = []
    erro = None
    uid = get_session_id()

    if request.method == "POST":
        file = request.files.get("file")
        if file:
            try:
                df = carregar_planilha(file)
                # Salva o dataframe original e o pré-filtrado em arquivos PKL
                df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl"))
                df.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl"))
                
                colunas = df.columns.tolist()
                
                # Exibe um preview para evitar crash inicial
                limite = 2000
                df_to_render = df.head(limite).fillna('')
                # Injeta o Index original na coluna 0 para o frontend
                dados = [[idx] + row for idx, row in zip(df_to_render.index, df_to_render.values.tolist())]
            except Exception as e:
                erro = str(e)

    return render_template("index.html",
                           colunas=colunas,
                           dados=dados,
                           erro=erro,
                           colunas_escolhidas=colunas,
                           sugestoes=[])

@app.route("/filtrar", methods=["POST"])
def filtrar():
    uid = get_session_id()
    df_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl")
    
    if not os.path.exists(df_path):
        return "Nenhum arquivo carregado na sessão. Retorne ao início e reenvie.", 400

    df = pd.read_pickle(df_path)

    colunas_escolhidas = request.form.getlist("colunas")
    if not colunas_escolhidas:
        colunas_escolhidas = df.columns.tolist()

    termo_busca = request.form.get("busca", "").strip()
    remover_duplicados = request.form.get("remover_duplicados")
    coluna_duplicados = request.form.get("coluna_duplicados")
    remover_caracteres = request.form.get("remover_caracteres")
    coluna_limpar = request.form.get("coluna_limpar")

    df_filtrado = df[colunas_escolhidas].copy()

    # Limpeza de caracteres especiais
    if remover_caracteres:
        limpar_padrao = r'[()\-\s\.]+'
        if coluna_limpar == "TODAS":
            for col in df_filtrado.select_dtypes(include=['object', 'string']).columns:
                df_filtrado[col] = df_filtrado[col].astype(str).str.replace(limpar_padrao, '', regex=True)
        elif coluna_limpar and coluna_limpar in df_filtrado.columns:
            df_filtrado[coluna_limpar] = df_filtrado[coluna_limpar].astype(str).str.replace(limpar_padrao, '', regex=True)

    # Busca em qualquer coluna
    if termo_busca:
        mask = df_filtrado.apply(lambda col: col.astype(str).str.contains(termo_busca, case=False, na=False))
        df_filtrado = df_filtrado[mask.any(axis=1)]

    # Tratamento de duplicados
    if remover_duplicados and coluna_duplicados:
        df_filtrado = df_filtrado.drop_duplicates(subset=[coluna_duplicados])
    elif remover_duplicados:
        df_filtrado = df_filtrado.drop_duplicates()

    # Passa todos os dados paginados para o DataTables com o index em anexo
    limite = 2000
    df_to_render = df_filtrado.head(limite).fillna('') if len(df_filtrado) > limite else df_filtrado.fillna('')
    dados = [[idx] + row for idx, row in zip(df_to_render.index, df_to_render.values.tolist())]

    sugestoes = df_filtrado.astype(str).stack().unique().tolist()[:50]

    # Sobrescreve o arquivado cache filtrado com o novo recorte dele
    df_filtrado.to_pickle(os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl"))

    return render_template("index.html",
                           colunas=df.columns.tolist(),
                           colunas_escolhidas=colunas_escolhidas,
                           dados=dados,
                           sugestoes=sugestoes)


@app.route("/editar_celula", methods=["POST"])
def editar_celula():
    uid = get_session_id()
    df_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df.pkl")
    filtrado_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")
    
    if not os.path.exists(df_path):
        return {"status": "error", "message": "Sessão expirada"}, 400
        
    data = request.form
    row_id = data.get("row_id")
    col_name = data.get("col_name")
    new_value = data.get("new_value")
    
    if row_id is None or col_name is None:
        return {"status": "error", "message": "Dados inválidos"}, 400
        
    try:
        row_id = int(row_id) # O index numérico do pandas
    except ValueError:
        pass
        
    df = pd.read_pickle(df_path)
    if row_id in df.index and col_name in df.columns:
        df.at[row_id, col_name] = new_value
        df.to_pickle(df_path)
        
    if os.path.exists(filtrado_path):
        df_filtrado = pd.read_pickle(filtrado_path)
        if row_id in df_filtrado.index and col_name in df_filtrado.columns:
            df_filtrado.at[row_id, col_name] = new_value
            df_filtrado.to_pickle(filtrado_path)
            
    return {"status": "success"}

@app.route("/baixar", methods=["GET", "POST"])
def baixar():
    uid = get_session_id()
    filtrado_path = os.path.join(UPLOAD_FOLDER, f"{uid}_df_filtrado.pkl")
    
    if not os.path.exists(filtrado_path):
        return "Nenhum dado encontrado para baixar.", 400

    df_filtrado = pd.read_pickle(filtrado_path)

    if request.method == "POST":
        col_order_str = request.form.get("col_order")
        if col_order_str:
            import json
            try:
                col_order = json.loads(col_order_str)
                valid_cols = [c for c in col_order if c in df_filtrado.columns]
                missing = [c for c in df_filtrado.columns if c not in valid_cols]
                df_filtrado = df_filtrado[valid_cols + missing]
            except Exception as e:
                print("Erro ao processar col_order:", e)

    output = BytesIO()
    df_filtrado.to_excel(output, index=False, engine="openpyxl")
    output.seek(0)

    return send_file(
        output,
        download_name="planilha_filtrada.xlsx",
        as_attachment=True,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5050, debug=True)
