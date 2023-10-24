/// <reference path="../../bbljCalendar-1.0.2.js"/>
/** @type {BBLJCalendar} */
let calendar = null;
const apiEndPoint = "https://bbljcalendarapi.onrender.com/api";

window.addEventListener("DOMContentLoaded", onLoaded);

async function onLoaded() {
    initDial();
    let canvas = document.getElementById("calendar");
    let y = Number(document.getElementById("selYearDial").value);
    let m = Number(document.getElementById("selMonthDial").value);
    let config = new BBLJCalendarConfig();
    config.year = y;
    config.month = m;
    try {
        config.dateInfos = await getCalendarDateInfos(y, m);
    } catch (e) {
        config.dateInfos = null;
    }
    config.onDateClicked = function (dateInfo) {
        if (dateInfo) {
            alert(dateInfo.description);
        }
    }
    calendar = BBLJCalendar.mount(canvas, config);
    
}

function initDial() {
    let now = new Date();
    let optYears = document.querySelectorAll("#selYearDial *");
    for (let i = 0; i < optYears.length; i++) {
        /** @type {HTMLOptionElement} */
        let opt = optYears[i];
        opt.value = now.getFullYear() - 2 + i;
        opt.innerHTML = now.getFullYear() - 2 + i;
    }
    document.getElementById("selYearDial").value = `${now.getFullYear()}`;
    document.getElementById("selMonthDial").value = `${now.getMonth() + 1}`;
}

async function dial() {
    let y = Number(document.getElementById("selYearDial").value);
    let m = Number(document.getElementById("selMonthDial").value);
    calendar.config.year = y;
    calendar.config.month = m;
    try {
        calendar.config.dateInfos = await getCalendarDateInfos(y, m);
    } catch (e) {
        calendar.config.dateInfos = null;
    }
    calendar.updateCalendar();
}

/** @param y {number} @param m {number} @returns {[BBLJCalendarDateInfo]}*/
async function getCalendarDateInfos(y, m) {
    let dateInfos = [];
    await fetch(`${apiEndPoint}?y=${y}&m=${m}`, {
        method: "GET"
    }).then(function (res) {
        return res.json();
    }).then(function (gcs) {
        if (Array.isArray(gcs)) {
            for (let i = 0; i < gcs.length; i++) {
                let dateInfo = new BBLJCalendarDateInfo();
                dateInfo.date = new Date(gcs[i]["DateString"]);
                dateInfo.description = gcs[i]["Description"];
                dateInfo.isHoliday = gcs[i]["IsHoliday"] == 1;
                dateInfos.push(dateInfo);
            }
        }
    });
    return dateInfos;
}