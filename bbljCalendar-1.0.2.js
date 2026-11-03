class BBLJCalendar {
    /** @type {BBLJCalendarConfig} */
    config = new BBLJCalendarConfig();

    static #instances = new WeakMap();

    /**
     * @param {HTMLCanvasElement} canvas
     * @param {BBLJCalendarConfig} [config]
     * @returns {BBLJCalendar}
     */
    static mount(canvas, config) {
        if (!canvas || typeof canvas.getContext !== 'function') {
            throw new TypeError('A canvas element is required.');
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('A 2D canvas context is required.');
        const calendar = new BBLJCalendar();
        calendar.#canvas = canvas;
        calendar.#ctx = ctx;
        if (config) {
            calendar.config = config instanceof BBLJCalendarConfig
                ? config : Object.assign(new BBLJCalendarConfig(), config);
        }
        calendar.#populateCalendarDates();
        // Replacing a calendar on the same canvas must not accumulate listeners.
        BBLJCalendar.#instances.get(canvas)?.destroy();
        BBLJCalendar.#instances.set(canvas, calendar);
        canvas.addEventListener('mousemove', calendar.#onMouseMove);
        canvas.addEventListener('mouseleave', calendar.#onMouseLeave);
        canvas.addEventListener('click', calendar.#onClick);
        window.addEventListener('resize', calendar.#onResize);
        if (typeof ResizeObserver !== 'undefined') {
            calendar.#resizeObserver = new ResizeObserver(calendar.#onResize);
            calendar.#resizeObserver.observe(canvas);
        }
        calendar.#draw();
        return calendar;
    }

    /** Refresh after changing config or dateInfos. */
    updateCalendar() {
        if (this.#destroyed) return;
        this.#populateCalendarDates();
        this.#cursorPos = null;
        this.#draw();
    }

    /** @param {number} y @param {number} m Month in the range 1–12. */
    setYearMonth(y, m) {
        BBLJCalendar.#validateYearMonth(y, m);
        this.config.year = y;
        this.config.month = m;
        this.updateCalendar();
    }

    /** Remove all listeners. This instance can no longer render or handle input. */
    destroy() {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.#canvas?.removeEventListener('mousemove', this.#onMouseMove);
        this.#canvas?.removeEventListener('mouseleave', this.#onMouseLeave);
        this.#canvas?.removeEventListener('click', this.#onClick);
        window.removeEventListener('resize', this.#onResize);
        this.#resizeObserver?.disconnect();
        if (this.#canvas && BBLJCalendar.#instances.get(this.#canvas) === this) {
            BBLJCalendar.#instances.delete(this.#canvas);
        }
        this.#resizeObserver = null;
        this.#cursorPos = null;
        this.#calendarDates = [];
        this.#sourceDateInfos.clear();
        this.#ctx = null;
        this.#canvas = null;
    }

    #canvas = null;
    #ctx = null;
    #size = new Dimension2D();
    #columnWidth = 0;
    #rowHeight = 0;
    #weekCount = 0;
    #weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    #calendarDates = [];
    #sourceDateInfos = new Map();
    #cursorPos = null;
    #resizeObserver = null;
    #destroyed = false;

    static #validateYearMonth(year, month) {
        if (!Number.isInteger(year) || year < 1 || year > 9999 ||
            !Number.isInteger(month) || month < 1 || month > 12) {
            throw new RangeError('year must be an integer from 1 to 9999; month must be an integer from 1 to 12.');
        }
    }

    // setFullYear also handles years 1–99 without Date's implicit 1900 offset.
    static #date(year, month, day) {
        const date = new Date(0);
        date.setFullYear(year, month - 1, day);
        date.setHours(0, 0, 0, 0);
        return date;
    }

    static #dateKey(date) {
        return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    #populateCalendarDates() {
        const { year, month, dateInfos } = this.config;
        BBLJCalendar.#validateYearMonth(year, month);
        const first = BBLJCalendar.#date(year, month, 1);
        const last = BBLJCalendar.#date(year, month + 1, 0);
        this.#weekCount = Math.ceil((first.getDay() + last.getDate()) / 7);
        const start = BBLJCalendar.#date(year, month, 1 - first.getDay());
        this.#sourceDateInfos.clear();
        if (Array.isArray(dateInfos)) {
            for (const info of dateInfos) {
                // dateInfos dates must be valid Date objects; skip malformed entries.
                if (!info || Object.prototype.toString.call(info.date) !== '[object Date]' ||
                    !Number.isFinite(info.date.getTime())) continue;
                const key = BBLJCalendar.#dateKey(info.date);
                if (!this.#sourceDateInfos.has(key)) this.#sourceDateInfos.set(key, info);
            }
        }
        this.#calendarDates = [];
        for (let i = 0; i < this.#weekCount * 7; i++) {
            const info = new BBLJCalendarDateInfo();
            info.date = new Date(start.getTime());
            info.date.setDate(start.getDate() + i);
            const source = this.#sourceDateInfos.get(BBLJCalendar.#dateKey(info.date));
            if (source) {
                info.description = source.description ?? '';
                info.isHoliday = Boolean(source.isHoliday);
            }
            this.#calendarDates.push(info);
        }
    }

    #draw() {
        if (this.#destroyed || !this.#canvas) return;
        // Only resize the bitmap when the layout changes; resizing clears context state.
        const width = this.#canvas.clientWidth;
        const height = this.#canvas.clientHeight;
        const bitmapWidth = width;
        const bitmapHeight = height;
        if (this.#canvas.width !== bitmapWidth) this.#canvas.width = bitmapWidth;
        if (this.#canvas.height !== bitmapHeight) this.#canvas.height = bitmapHeight;
        this.#size.w = width;
        this.#size.h = height;
        this.#columnWidth = width / 7;
        this.#rowHeight = height / (this.#weekCount + 1);
        if (width <= 0 || height <= 0) return;
        this.#ctx.setTransform(bitmapWidth / width, 0, 0, bitmapHeight / height, 0, 0);
        this.#ctx.clearRect(0, 0, width, height);
        this.#ctx.font = `${this.config.fontSize} Arial`;
        this.#ctx.textAlign = 'center';
        this.#ctx.textBaseline = 'middle';
        this.#drawWeekDays();
        this.#drawCalendarDates();
        this.#drawBorder();
    }

    #drawWeekDays() {
        this.#ctx.fillStyle = 'green';
        this.#ctx.fillRect(0, 0, this.#size.w, this.#rowHeight);
        this.#ctx.fillStyle = 'white';
        for (let i = 0; i < this.#weekDays.length; i++) {
            this.#ctx.fillText(this.#weekDays[i], (i + 0.5) * this.#columnWidth,
                this.#rowHeight / 2, this.#columnWidth);
        }
    }

    #drawCalendarDates() {
        for (let i = 0; i < this.#calendarDates.length; i++) {
            const info = this.#calendarDates[i];
            const column = i % 7;
            const row = Math.floor(i / 7) + 1;
            const x = column * this.#columnWidth;
            const y = row * this.#rowHeight;
            this.#ctx.fillStyle = info.date.getMonth() + 1 === this.config.month &&
                info.date.getFullYear() === this.config.year ? 'white' : 'rgb(220, 220, 220)';
            if (this.#cursorPos?.x === column && this.#cursorPos?.y === row) {
                this.#ctx.fillStyle = 'yellow';
            }
            this.#ctx.fillRect(x, y, this.#columnWidth, this.#rowHeight);
            this.#ctx.fillStyle = info.isHoliday ? 'red' : 'black';
            this.#ctx.fillText(info.date.getDate(), x + this.#columnWidth / 2,
                y + this.#rowHeight / 2, this.#columnWidth);
        }
    }

    #drawBorder() {
        const ctx = this.#ctx;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'black';
        const inset = ctx.lineWidth / 2;
        ctx.beginPath();
        ctx.rect(inset, inset, this.#size.w - ctx.lineWidth, this.#size.h - ctx.lineWidth);
        for (let i = 1; i < 7; i++) {
            ctx.moveTo(this.#columnWidth * i, 0);
            ctx.lineTo(this.#columnWidth * i, this.#size.h);
        }
        for (let i = 1; i <= this.#weekCount; i++) {
            ctx.moveTo(0, this.#rowHeight * i);
            ctx.lineTo(this.#size.w, this.#rowHeight * i);
        }
        ctx.stroke();
    }

    /** @param {MouseEvent} event @returns {Vector2D|null} */
    #getCell(event) {
        const rect = this.#canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0 || this.#size.w <= 0 || this.#size.h <= 0) return null;
        // Account for CSS scaling; client coordinates also work for touch-generated clicks.
        const x = (event.clientX - rect.left) * this.#size.w / rect.width;
        const y = (event.clientY - rect.top) * this.#size.h / rect.height;
        if (!Number.isFinite(x) || !Number.isFinite(y) ||
            x < 0 || y < this.#rowHeight || x >= this.#size.w || y >= this.#size.h) return null;
        const cell = new Vector2D(Math.floor(x / this.#columnWidth), Math.floor(y / this.#rowHeight));
        const index = (cell.y - 1) * 7 + cell.x;
        return index >= 0 && index < this.#calendarDates.length ? cell : null;
    }

    #onMouseMove = event => {
        if (this.#destroyed) return;
        const cell = this.#getCell(event);
        if (cell?.x === this.#cursorPos?.x && cell?.y === this.#cursorPos?.y) return;
        this.#cursorPos = cell;
        this.#draw();
    };

    #onMouseLeave = () => {
        if (this.#destroyed || !this.#cursorPos) return;
        this.#cursorPos = null;
        this.#draw();
    };

    #onClick = event => {
        if (this.#destroyed) return;
        const cell = this.#getCell(event);
        if (!cell) return;
        const info = this.#calendarDates[(cell.y - 1) * 7 + cell.x];
        // Preserve the original object (and custom fields) for provided dates.
        const selected = this.#sourceDateInfos.get(BBLJCalendar.#dateKey(info.date)) ?? info;
        if (typeof this.config.onDateClicked === 'function') {
            this.config.onDateClicked(selected);
        }
    };

    #onResize = () => {
        this.#cursorPos = null;
        this.#draw();
    };
}

class BBLJCalendarConfig {
    /** @type {number} */
    year;
    /** @type {number} Month in the range 1–12. */
    month;
    /** @type {string} */
    fontSize = '1.25em';
    /** @type {BBLJCalendarDateInfo[]} */
    dateInfos = [];
    /** @param {BBLJCalendarDateInfo} calendarDay */
    onDateClicked = function (calendarDay) {};

    constructor() {
        const now = new Date();
        this.year = now.getFullYear();
        this.month = now.getMonth() + 1;
    }
}

class BBLJCalendarDateInfo {
    /** @type {Date} Local calendar date. */
    date = new Date();
    /** @type {boolean} */
    isHoliday = false;
    /** @type {string} */
    description = '';
}

class Dimension2D {
    constructor(w = 0, h = 0) {
        this.w = w;
        this.h = h;
    }
}

class Vector2D {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
}
