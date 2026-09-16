export function loadJson<T>(key: string, fallback: T) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? (JSON.parse(saved) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // React 이벤트 객체처럼 직렬화할 수 없는 값이 섞여도 앱 렌더링은 계속 유지합니다.
  }
}
