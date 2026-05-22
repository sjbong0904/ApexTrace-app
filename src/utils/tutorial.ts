// src/utils/tutorial.ts
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import i18n from '../i18n';

export const startTutorial = () => {
    const driverObj = driver({
        showProgress: true,
        animate: true,
        steps: [
            {
                element: '#nav-dashboard',
                popover: {
                    title: i18n.t('tutorial.dashboardTitle'),
                    description: i18n.t('tutorial.dashboardDesc'),
                    side: "right",
                    align: 'start',
                },
            },
            {
                element: '#search-bar',
                popover: {
                    title: i18n.t('tutorial.searchTitle'),
                    description: i18n.t('tutorial.searchDesc'),
                    side: "bottom",
                    align: 'end',
                },
            },
            {
                element: '#sidebar-profile',
                popover: {
                    title: i18n.t('tutorial.profileTitle'),
                    description: i18n.t('tutorial.profileDesc'),
                    side: "right",
                    align: 'start',
                },
            },
            {
                element: '#nav-statistics',
                popover: {
                    title: i18n.t('tutorial.statisticsTitle'),
                    description: i18n.t('tutorial.statisticsDesc'),
                    side: "right",
                    align: 'start',
                },
            },
            {
                element: '#nav-settings',
                popover: {
                    title: i18n.t('tutorial.settingsTitle'),
                    description: i18n.t('tutorial.settingsDesc'),
                    side: "right",
                    align: 'start',
                },
            },
        ],
    });

    driverObj.drive();
};
