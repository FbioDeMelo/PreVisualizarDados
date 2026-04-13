import pandas as pd
from io import BytesIO

def carregar_planilha(file):
    """
    Lê a planilha (XLSX, XLS ou CSV) e retorna um DataFrame.
    """
    arquivo_bytes = file.read()
    file.seek(0)

    try:
        return pd.read_excel(BytesIO(arquivo_bytes), engine="openpyxl")
    except:
        try:
            return pd.read_excel(BytesIO(arquivo_bytes), engine="xlrd")
        except:
            try:
                return pd.read_csv(BytesIO(arquivo_bytes), encoding="utf-8", sep=",")
            except:
                raise ValueError("Arquivo inválido. Use XLSX, XLS ou CSV.")
