use super::*;

#[tauri::command]
pub(crate) async fn mcp_refresh_mcp_and_skills(
    state: State<'_, AppState>,
) -> Result<RefreshMcpAndSkillsResult, String> {
    reload_workspace(&state).await
}

#[tauri::command]
pub(crate) fn mcp_list_skills(state: State<'_, AppState>) -> Result<SkillListResult, String> {
    let (skills, errors) = load_workspace_skill_summaries_with_errors(&state)?;
    let _ = update_hidden_skill_snapshot_cache(&state, &skills, None);
    Ok(SkillListResult { skills, errors })
}

#[tauri::command]
pub(crate) fn skill_open_workspace_dir(state: State<'_, AppState>) -> Result<String, String> {
    open_skills_workspace_dir(&state)
}

