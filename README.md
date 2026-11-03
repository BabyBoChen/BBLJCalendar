# BBLJ月曆

BBLJ月曆是一款使用Canvas API繪製出的JS月曆元件，結合「中華民國政府行政機關辦公日曆表」所提供的資料，標示出各年度的平日以及例假日相關資訊。

Demo:
https://bblj-calendar.netlify.app/

## 使用方式

引入 `bbljCalendar-1.0.2.min.js`，再呼叫：

```js
const config = new BBLJCalendarConfig();
config.year = 2026;
config.month = 2; // 月份為 1～12；不指定時預設為當前年月。
config.onDateClicked = function (dateInfo) {
    console.log(dateInfo.date, dateInfo.description);
};
const calendar = BBLJCalendar.mount(document.getElementById('calendar'), config);

calendar.setYearMonth(2026, 12);
// 修改 config.dateInfos 後，呼叫 calendar.updateCalendar() 套用。
// 元件移除時，呼叫 calendar.destroy() 解除事件及尺寸監聽。
```

- 年份接受 1～9999 的整數，月份接受 1～12 的整數；無效值會拋出 `RangeError`。
- 月曆依月份顯示四、五或六週，並補齊該週的上個月與下個月日期。
- 點擊任何日期（含相鄰月份）都會回傳日期資訊；點擊星期標題或範圍外不會呼叫回呼。
- `dateInfos` 的 `date` 必須是有效的 `Date`，依本地年月日比對，忽略時間。無效項目會跳過，重複日期採第一筆。
- 有提供資料的日期會回傳原始物件，保留額外欄位；其他日期回傳 `BBLJCalendarDateInfo`，預設 `description` 為空字串、`isHoliday` 為 `false`。未提供資料時不會自動推斷假日。
- 修改 `dateInfos` 後需呼叫 `updateCalendar()`。可透過 CSS 設定 Canvas 尺寸；支援 `ResizeObserver` 的瀏覽器也會追蹤容器造成的尺寸變化。
- 同一個 Canvas 再次掛載時會自動清理舊實例。`destroy()` 可重複呼叫；已清理的實例不再繪製或處理事件。
