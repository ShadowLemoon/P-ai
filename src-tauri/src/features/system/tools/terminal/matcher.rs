fn terminal_tokenize(command: &str) -> Vec<String> {
    let mut tokens = Vec::<String>::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut chars = command.chars().peekable();
    while let Some(ch) = chars.next() {
        if let Some(q) = quote {
            if ch == q {
                quote = None;
            } else if ch == '\\' {
                if let Some(next) = chars.peek().copied() {
                    if next == q || next == '\\' {
                        current.push(next);
                        chars.next();
                    } else {
                        current.push(ch);
                    }
                } else {
                    current.push(ch);
                }
            } else {
                current.push(ch);
            }
            continue;
        }

        if ch == '\'' || ch == '"' {
            quote = Some(ch);
            continue;
        }
        if ch.is_whitespace() {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
            continue;
        }
        if matches!(ch, '>' | '<' | '|' | ';') {
            if !current.is_empty() {
                tokens.push(current.clone());
                current.clear();
            }
            if ch == '>' && chars.peek().copied() == Some('>') {
                chars.next();
                tokens.push(">>".to_string());
            } else {
                tokens.push(ch.to_string());
            }
            continue;
        }
        current.push(ch);
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

fn terminal_unquote_token(token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        if (bytes[0] == b'\'' && bytes[trimmed.len() - 1] == b'\'')
            || (bytes[0] == b'"' && bytes[trimmed.len() - 1] == b'"')
        {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

#[cfg(target_os = "windows")]
fn terminal_has_windows_drive_prefix(token: &str) -> bool {
    let bytes = token.as_bytes();
    if bytes.len() < 2 || bytes[1] != b':' || !bytes[0].is_ascii_alphabetic() {
        return false;
    }
    if bytes.len() == 2 {
        return true;
    }
    matches!(bytes[2], b'\\' | b'/')
}

#[cfg(not(target_os = "windows"))]
fn terminal_has_windows_drive_prefix(_token: &str) -> bool {
    false
}

fn terminal_is_explicit_path_token(token: &str) -> bool {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return false;
    }
    if trimmed.starts_with('-') {
        return false;
    }
    if trimmed.contains("://") {
        return false;
    }
    if matches!(
        trimmed,
        "|" | "||" | "&" | "&&" | ";" | ">" | ">>" | "<" | "2>" | "1>"
    ) {
        return false;
    }
    if PathBuf::from(trimmed).is_absolute() {
        return true;
    }
    if terminal_has_windows_drive_prefix(trimmed) {
        return true;
    }
    trimmed.starts_with("./")
        || trimmed.starts_with(".\\")
        || trimmed.starts_with("../")
        || trimmed.starts_with("..\\")
        || trimmed.starts_with("~/")
        || trimmed.starts_with("~\\")
        || trimmed.contains('\\')
        || trimmed.contains('/')
}

fn terminal_is_posix_style_shell(shell_kind: &str) -> bool {
    matches!(shell_kind, "git-bash" | "bash" | "zsh" | "sh")
}

fn terminal_is_virtual_sink_path(token: &str, shell_kind: &str) -> bool {
    let trimmed = token.trim().to_ascii_lowercase();
    if terminal_is_posix_style_shell(shell_kind) {
        return matches!(
            trimmed.as_str(),
            "/dev/null" | "/dev/stdout" | "/dev/stderr" | "/dev/tty"
        );
    }
    matches!(trimmed.as_str(), "nul" | "con" | "prn" | "aux")
}

fn terminal_command_contains_absolute_path_token(command: &str, shell_kind: &str) -> bool {
    let tokens = terminal_tokenize(command);
    for token in tokens {
        let unquoted = terminal_unquote_token(&token);
        let trimmed = unquoted.trim();
        if trimmed.is_empty() {
            continue;
        }
        if terminal_is_virtual_sink_path(trimmed, shell_kind) {
            continue;
        }
        if trimmed.contains("://") {
            continue;
        }
        if PathBuf::from(trimmed).is_absolute() || terminal_has_windows_drive_prefix(trimmed) {
            return true;
        }
    }
    false
}

fn terminal_resolve_candidate_path(cwd: &Path, raw: &str) -> Option<PathBuf> {
    let token = terminal_unquote_token(raw);
    if token.is_empty() {
        return None;
    }
    if token.starts_with('-') {
        return None;
    }
    if token.contains('*') || token.contains('?') {
        return None;
    }
    if token.contains("://") {
        return None;
    }
    if matches!(token.as_str(), "|" | "||" | "&" | "&&" | ";" | ">" | ">>" | "<")
    {
        return None;
    }
    let normalized = normalize_terminal_path_input_for_current_platform(&token);
    if normalized.is_empty() {
        return None;
    }
    let candidate = PathBuf::from(&normalized);
    let joined = if candidate.is_absolute() {
        candidate
    } else {
        cwd.join(candidate)
    };
    Some(joined)
}

fn terminal_dedup_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut out = Vec::<PathBuf>::new();
    let mut seen = std::collections::HashSet::<String>::new();
    for path in paths {
        let key = normalize_terminal_path_for_compare(&path);
        if seen.insert(key) {
            out.push(path);
        }
    }
    out
}

fn terminal_collect_command_path_candidates(
    cwd: &Path,
    command: &str,
    shell_kind: &str,
) -> Vec<PathBuf> {
    let tokens = terminal_tokenize(command);
    if tokens.is_empty() {
        return Vec::new();
    }

    let mut raw_paths = Vec::<String>::new();
    let mut idx = 0usize;
    while idx < tokens.len() {
        let token = terminal_unquote_token(&tokens[idx]);
        let lower = token.to_ascii_lowercase();

        if (lower == ">" || lower == ">>")
            && tokens
                .get(idx + 1)
                .map(|next| !next.trim().is_empty())
                .unwrap_or(false)
        {
            if !terminal_is_virtual_sink_path(&tokens[idx + 1], shell_kind) {
                raw_paths.push(tokens[idx + 1].clone());
            }
            idx += 2;
            continue;
        }

        if matches!(
            lower.as_str(),
            "-path"
                | "-literalpath"
                | "--path"
                | "-file"
                | "--file"
                | "-output"
                | "--output"
        ) && tokens
            .get(idx + 1)
            .map(|next| !next.trim().is_empty())
            .unwrap_or(false)
        {
            raw_paths.push(tokens[idx + 1].clone());
            idx += 2;
            continue;
        }

        if terminal_is_explicit_path_token(&token) {
            if terminal_is_virtual_sink_path(&token, shell_kind) {
                idx += 1;
                continue;
            }
            raw_paths.push(token);
        }

        idx += 1;
    }

    let mut out = Vec::<PathBuf>::new();
    for raw in raw_paths {
        if let Some(path) = terminal_resolve_candidate_path(cwd, &raw) {
            out.push(path);
        }
    }
    terminal_dedup_paths(out)
}

fn terminal_collect_ungranted_command_paths(
    state: &AppState,
    session_id: &str,
    cwd: &Path,
    command: &str,
    shell_kind: &str,
) -> Result<Vec<PathBuf>, String> {
    let mut blocked = Vec::<PathBuf>::new();
    for path in terminal_collect_command_path_candidates(cwd, command, shell_kind) {
        let normalized = terminal_normalize_for_access_check(&path);
        if !terminal_path_allowed(state, session_id, &normalized)? {
            blocked.push(normalized);
        }
    }
    Ok(terminal_dedup_paths(blocked))
}

#[cfg(test)]
mod terminal_matcher_tests {
    use super::*;

    #[test]
    fn should_ignore_dev_null_in_absolute_path_check_for_git_bash() {
        let cmd = r#"ls -la ./skills/ 2>/dev/null || echo "No skills directory""#;
        assert!(!terminal_command_contains_absolute_path_token(cmd, "git-bash"));
    }

    #[test]
    fn should_collect_relative_path_but_not_dev_null_for_git_bash() {
        let cwd = PathBuf::from("C:\\Users\\tester\\llm-workspace");
        let cmd = r#"find ./skills -name "mcp-setup*" -o -name "*mcp*setup" 2>/dev/null | head -10"#;
        let paths = terminal_collect_command_path_candidates(&cwd, cmd, "git-bash");
        assert!(
            paths.iter().any(|p| p.to_string_lossy().contains("skills")),
            "expected ./skills to be collected"
        );
        assert!(
            !paths.iter().any(|p| {
                p.to_string_lossy()
                    .to_ascii_lowercase()
                    .replace('\\', "/")
                    .contains("dev/null")
            }),
            "expected /dev/null to be ignored"
        );
    }
}
