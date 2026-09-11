const SURVEY_URL = "https://forms.gle/q4qkfmYVZw28tYHNA";

window.addEventListener("DOMContentLoaded", () => {
    if (window.overwolf?.utils?.openUrlInDefaultBrowser) {
        overwolf.utils.openUrlInDefaultBrowser(SURVEY_URL);
    } else {
        window.location.href = SURVEY_URL;
    }
});
