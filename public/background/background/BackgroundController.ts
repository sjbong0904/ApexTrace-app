// src/background/BackgroundController.ts

export class BackgroundController {

    constructor() {
        this.init();
    }

    private init = () => {
        // desktop 창은 main.js initApp → WindowController.openMainWindow 에서만 연다 (중복 복원 방지)
        this.registerEvents();
    }

    private registerEvents = () => {
    }
}

new BackgroundController();