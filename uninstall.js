// public/uninstall.js (또는 빌드 후 html과 같은 경로에 위치할 파일)

const SURVEY_URL = "https://forms.gle/q4qkfmYVZw28tYHNA";

window.addEventListener("DOMContentLoaded", () => {
    if (window.overwolf?.utils?.openUrlInDefaultBrowser) {
        overwolf.utils.openUrlInDefaultBrowser(SURVEY_URL);
    } else {
        window.location.href = SURVEY_URL;
    }
});
