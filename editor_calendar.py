import streamlit as st
from streamlit_calendar import calendar
import pandas as pd
import gspread
from oauth2client.service_account import ServiceAccountCredentials
from datetime import datetime, timedelta
import uuid

# 設定頁面
st.set_page_config(layout="wide")
st.title("🎬 剪輯任務日程")

# 顏色圖例（剪輯師 Color Legend）
st.markdown("""
<div style='display: flex; gap: 20px; margin-top: 10px; margin-bottom: 20px;'>
    <div style='display: flex; align-items: center; gap: 5px;'>
        <div style='width: 15px; height: 15px; background-color: #91D4C2; border-radius: 3px;'></div>
        <span style='font-size: 14px;'>Dolphine</span>
    </div>
    <div style='display: flex; align-items: center; gap: 5px;'>
        <div style='width: 15px; height: 15px; background-color: #FED880; border-radius: 3px;'></div>
        <span style='font-size: 14px;'>Eason</span>
    </div>
    <div style='display: flex; align-items: center; gap: 5px;'>
        <div style='width: 15px; height: 15px; background-color: #85B8CB; border-radius: 3px;'></div>
        <span style='font-size: 14px;'>James</span>
    </div>
    <div style='display: flex; align-items: center; gap: 5px;'>
        <div style='width: 15px; height: 15px; background-color: #DBD7D7; border-radius: 3px;'></div>
        <span style='font-size: 14px;'>Unknown</span>
    </div>
</div>
""", unsafe_allow_html=True)

# 注入自定義 CSS 僅用於按鈕顏色
st.markdown("""
    <style>
    .fc .fc-button {
        background-color: #007BFF !important;
        color: #FFFFFF !important;
        border: none !important;
        border-radius: 5px;
        padding: 5px 10px;
        font-weight: bold;
    }
    .fc .fc-button:hover {
        background-color: #0056b3 !important;
    }
    .fc .fc-button:focus {
        box-shadow: none !important;
    }
    </style>
""", unsafe_allow_html=True)

# Google Sheets 連線
scope = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
import json
google_json = json.loads(st.secrets["GOOGLE_CREDENTIALS"])
creds = ServiceAccountCredentials.from_json_keyfile_dict(google_json, scope)
client = gspread.authorize(creds)

SHEET_NAME = "Editor Calendar"
WORKSHEET_NAME = "任務排程"

try:
    sheet = client.open(SHEET_NAME).worksheet(WORKSHEET_NAME)
    data = sheet.get_all_records()
    tasks_df = pd.DataFrame(data)
except Exception as e:
    st.error(f"❌ 無法讀取 Google Sheet: {e}")
    st.stop()

# 確保必要欄位存在
required_cols = ["ID", "StartDate", "EndDate", "Episode", "Project", "Editor"]
for col in required_cols:
    if col not in tasks_df.columns:
        st.warning(f"⚠️ 缺少欄位：{col}")
        st.stop()

# 轉換日期格式並正規化
tasks_df["StartDate"] = pd.to_datetime(tasks_df["StartDate"], format="%Y-%m-%d", errors="coerce").dt.normalize()
tasks_df["EndDate"] = pd.to_datetime(tasks_df["EndDate"], format="%Y-%m-%d", errors="coerce").dt.normalize()

# 檢查日期解析問題
invalid_dates = tasks_df[tasks_df["StartDate"].isna() | tasks_df["EndDate"].isna()]
if not invalid_dates.empty:
    st.warning(f"⚠️ 以下任務的日期格式無效，將被跳過：\n{invalid_dates[['ID', 'StartDate', 'EndDate']].to_dict('records')}")

# 顏色對應（剪輯師）
color_map = {
    "Dolphine": "#91D4C2",
    "Eason": "#FED880",
    "James": "#85B8CB",
    "Unknown": "#DBD7D7"
}

# 轉換為 FullCalendar 的事件格式
events = []
for _, row in tasks_df.iterrows():
    if pd.notnull(row["StartDate"]) and pd.notnull(row["EndDate"]):
        title = f'{row["Project"]} (Ep. {row["Episode"]}) - {row["Editor"]}'
        start = row["StartDate"]
        end = row["EndDate"] + timedelta(days=1)  # FullCalendar end date is exclusive
        color = color_map.get(row["Editor"], "#DBD7D7")  # 使用 Unknown 的顏色作為預設
        events.append({
            "id": str(row["ID"]),
            "title": title,
            "start": start.strftime("%Y-%m-%d"),
            "end": end.strftime("%Y-%m-%d"),
            "color": color
        })
    else:
        st.warning(f"⚠️ 跳過 ID {row['ID']}：無效的開始或結束日期")

# 顯示行事曆
calendar_options = {
    "editable": True,
    "selectable": True,
    "headerToolbar": {
        "left": "prev,next today",
        "center": "title",
        "right": "dayGridMonth"  # Only month view
    },
    "initialView": "dayGridMonth"
}
returned = calendar(
    events=events,
    options=calendar_options,
    key="calendar"
)

# 處理點擊事件
if returned and "eventClick" in returned:
    event_id = returned["eventClick"]["event"]["id"]
    selected_task = tasks_df[tasks_df["ID"].astype(str) == str(event_id)]
    if not selected_task.empty:
        task = selected_task.iloc[0]
        project_options = ["Correspondents", "DC Insiders", "Finding Formosa", "In Case You Missed It", "Zoom In Zoom Out", "Other"]
        editor_options = ["Dolphine", "Eason", "James", "Unknown"]  # Added "Unknown"
        project_index = project_options.index(task["Project"]) if task["Project"] in project_options else 0
        editor_index = editor_options.index(task["Editor"]) if task["Editor"] in editor_options else 0
        with st.sidebar:
            st.subheader("✏️ 編輯任務")
            new_project = st.selectbox("節目名稱", project_options, index=project_index, key=f"edit_project_{event_id}")
            new_editor = st.selectbox("剪輯師", editor_options, index=editor_index, key=f"edit_editor_{event_id}")
            new_episode = st.text_input("集數", value=str(task["Episode"]), key=f"edit_episode_{event_id}")
            new_start = st.date_input("開始日期", task["StartDate"].date(), key=f"edit_start_{event_id}")
            new_end = st.date_input("結束日期", task["EndDate"].date() if pd.notnull(task["EndDate"]) else new_start, key=f"edit_end_{event_id}")

            if st.button("💾 儲存變更", key=f"save_{event_id}"):
                row_idx = tasks_df[tasks_df["ID"].astype(str) == str(event_id)].index[0] + 2
                sheet.update_cell(row_idx, required_cols.index("Project") + 1, new_project)
                sheet.update_cell(row_idx, required_cols.index("Editor") + 1, new_editor)
                sheet.update_cell(row_idx, required_cols.index("Episode") + 1, new_episode)
                sheet.update_cell(row_idx, required_cols.index("StartDate") + 1, new_start.strftime("%Y-%m-%d"))
                sheet.update_cell(row_idx, required_cols.index("EndDate") + 1, new_end.strftime("%Y-%m-%d"))
                st.success("✅ 任務已更新，請重新整理頁面")
    else:
        st.warning("⚠️ 找不到任務資料。可能是 ID 遺失。")

# 拖曳事件更新日期
if returned and "eventDrop" in returned:
    event_id = returned["eventDrop"]["event"]["id"]
    new_start = returned["eventDrop"]["event"]["start"]
    new_end = returned["eventDrop"]["event"].get("end", new_start)

    idx = tasks_df[tasks_df["ID"].astype(str) == str(event_id)].index
    if not idx.empty:
        row_idx = idx[0] + 2
        sheet.update_cell(row_idx, required_cols.index("StartDate") + 1, new_start.split("T")[0])
        sheet.update_cell(row_idx, required_cols.index("EndDate") + 1, (pd.to_datetime(new_end) - timedelta(days=1)).strftime("%Y-%m-%d"))
        st.success("📆 日期已更新")

# 新增任務
with st.sidebar:
    st.markdown("---")
    st.subheader("🆕 新增任務")
    new_project = st.selectbox("節目名稱", ["Correspondents", "DC Insiders", "Finding Formosa", "In Case You Missed It", "Zoom In Zoom Out", "Other"], key="new_proj")
    new_editor = st.selectbox("剪輯師", ["Dolphine", "Eason", "James", "Unknown"], key="new_editor")  # Added "Unknown"
    new_episode = st.text_input("集數", value="1", key="new_episode")
    start_date = st.date_input("開始日期", datetime.today(), key="new_start")
    end_date = st.date_input("結束日期", datetime.today(), key="new_end")

    if st.button("➕ 新增"):
        new_id = str(uuid.uuid4())[:8]
        new_row = [new_id, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), new_episode, new_project, new_editor]
        sheet.append_row(new_row)
        st.success("✅ 任務已新增，請重新整理頁面")
