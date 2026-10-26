(() => {
    const styles = `
        :root {
            --navy: #102a43;
            --navy-dark: #071a2d;
            --navy-light: #1d4e73;
            --red: #dc4c4c;
            --green-status: #e1f5ec;
            --green-status-strong: #16845b;
            --green-text: #126747;
            --red-status: #ffeded;
            --red-status-strong: #c73d4b;
            --red-text: #a92f3d;
            --border-color: #e3eaf0;
            --bg-page: #f3f6f9;
            --card-bg: rgba(255, 255, 255, 0.96);
            --text-main: #182b3a;
            --text-muted: #687d8d;
            --gold: #b98724;
            --surface-raised: #fff;
            --shadow-soft: 0 8px 24px rgba(20, 46, 68, 0.06);
            --shadow-card: 0 12px 32px rgba(20, 46, 68, 0.08), 0 2px 6px rgba(20, 46, 68, 0.04);
            --shadow-hover: 0 20px 44px rgba(20, 46, 68, 0.13), 0 5px 12px rgba(20, 46, 68, 0.06);
            --radius-card: 18px;
            --focus-ring: 0 0 0 4px rgba(53, 125, 168, 0.18);
        }

        html { scroll-behavior: smooth; scroll-padding-top: 90px; }
        body {
            min-height: 100vh;
            font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;
            background:
                radial-gradient(ellipse at 4% 0%, rgba(100, 165, 194, 0.13), transparent 34rem),
                radial-gradient(ellipse at 96% 8%, rgba(110, 158, 181, 0.12), transparent 30rem),
                var(--bg-page);
            color: var(--text-main);
            letter-spacing: 0.005em;
        }

        .topbar {
            min-height: 112px;
            padding: 1.25rem clamp(1rem, 4vw, 3.5rem);
            gap: 1.25rem;
            background: linear-gradient(118deg, #0b2035 0%, #123b5b 58%, #1d5272 100%);
            box-shadow: 0 12px 32px rgba(7, 26, 45, 0.22);
        }
        .topbar::before {
            content: "";
            position: absolute;
            width: 420px;
            height: 420px;
            right: 7%;
            top: -300px;
            border: 1px solid rgba(255,255,255,.12);
            border-radius: 50%;
            box-shadow: 0 0 0 38px rgba(255,255,255,.025), 0 0 0 82px rgba(255,255,255,.025);
            pointer-events: none;
        }
        .topbar::after {
            width: 420px;
            height: 420px;
            right: -190px;
            top: -180px;
            background: radial-gradient(circle, rgba(91, 178, 202, .24), transparent 68%);
        }
        .hamburger-btn {
            width: 42px;
            height: 42px;
            display: inline-flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 5px;
            flex: 0 0 auto;
            border: 1px solid rgba(255,255,255,.25);
            border-radius: 13px;
            background: rgba(255,255,255,.1);
            transition: background .2s, transform .2s, border-color .2s;
        }
        .hamburger-btn:hover { background: rgba(255,255,255,.2); transform: translateY(-2px); }
        .hamburger-btn span { width: 17px; height: 2px; border-radius: 2px; background: #fff; }
        .logo-wrap {
            padding: .55rem .9rem;
            border-radius: 13px;
            box-shadow: 0 8px 22px rgba(0,0,0,.16);
        }
        .header-title { max-width: 640px; }
        .header-title h1 { font-size: clamp(1.15rem, 2vw, 1.55rem); font-weight: 750; }
        .header-title p { color: #c7d8e5; font-size: .88rem; }
        .header-watermark { color: #c3d8e8; right: 1.4rem; bottom: .65rem; }

        .module-bar {
            position: sticky;
            top: 0;
            z-index: 100;
            display: flex;
            justify-content: center;
            padding: .65rem 1rem;
            background: rgba(243, 246, 249, .86);
            border-bottom: 1px solid rgba(211, 223, 232, .85);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
        }
        .module-bar-inner {
            display: flex;
            width: min(100%, 1320px);
            justify-content: center;
            gap: .5rem;
        }
        .module-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: .55rem;
            min-height: 44px;
            padding: .6rem 1rem;
            color: #526a7b;
            background: transparent;
            border: 1px solid transparent;
            border-radius: 13px;
            font: inherit;
            font-size: .86rem;
            font-weight: 700;
            white-space: nowrap;
            cursor: pointer;
            transition: transform .2s, color .2s, background .2s, box-shadow .2s, border-color .2s;
        }
        .module-link:hover {
            color: var(--navy);
            background: rgba(255,255,255,.8);
            border-color: #e0e8ee;
            transform: translateY(-1px);
        }
        .module-link.active {
            color: #fff;
            border-color: #163e5d;
            background: linear-gradient(135deg, #173e5b, #245b77);
            box-shadow: 0 7px 16px rgba(16, 53, 78, .22), inset 0 1px rgba(255,255,255,.18);
        }
        .module-link-icon { font-size: 1rem; line-height: 1; }

        main { max-width: 1480px; padding: clamp(1rem, 2.4vw, 2rem); }
        #page-nuflo, #page-pressure, #page-ceor, #page-opm { min-height: 56vh; }
        .card {
            padding: clamp(1rem, 2vw, 1.5rem);
            margin-bottom: 1.1rem;
            border: 1px solid rgba(218, 228, 236, .9);
            border-radius: var(--radius-card);
            background: var(--card-bg);
            box-shadow: var(--shadow-card);
            animation-duration: .42s;
        }
        .card h3 { color: #183b55; font-weight: 730; letter-spacing: -.02em; }
        .card h4, .card h5 { letter-spacing: -.01em; }
        .upload-card { overflow: hidden; position: relative; }
        .upload-card::before {
            content: "";
            position: absolute;
            left: 0; top: 0; bottom: 0;
            width: 4px;
            background: linear-gradient(180deg, #57a9b4, #2d6687);
            opacity: .9;
        }
        .dropzone, .drop-zone {
            border: 1.5px dashed #9fb7c7;
            border-radius: 16px;
            background: linear-gradient(145deg, #f9fcfd, #f2f7fa);
            transition: border-color .22s, background .22s, transform .22s, box-shadow .22s;
        }
        .dropzone:hover, .dropzone.dragover, .drop-zone:hover, .drop-zone.dragover {
            border-color: #347d9e;
            background: linear-gradient(145deg, #f2fafb, #eaf4f7);
            box-shadow: inset 0 0 0 1px rgba(52,125,158,.14), 0 8px 22px rgba(35,91,116,.08);
            transform: translateY(-2px);
        }
        .dropzone-icon { filter: drop-shadow(0 5px 8px rgba(24,79,107,.16)); }
        .file-info { border: 1px solid #dce8ee; border-radius: 12px; background: #f5f9fb; }
        #page-nuflo #upload-section.upload-card {
            position: relative;
            isolation: isolate;
            overflow: hidden;
            padding: clamp(1.25rem, 3.5vw, 2.6rem);
            border: 1px solid rgba(173, 133, 73, .34);
            border-radius: 26px;
            background:
                radial-gradient(ellipse at 94% 8%, rgba(199, 159, 99, .18), transparent 28rem),
                linear-gradient(145deg, rgba(255, 252, 244, .98), rgba(248, 239, 221, .97));
            box-shadow: 0 22px 56px rgba(76, 49, 27, .12), inset 0 1px rgba(255,255,255,.9);
        }
        #page-nuflo #upload-section.upload-card::before {
            z-index: -1;
            width: 5px;
            background: linear-gradient(180deg, #d9b875, #8b6334 52%, #d9b875);
        }
        #page-nuflo #upload-section.upload-card::after {
            content: "";
            position: absolute;
            z-index: -1;
            top: -125px;
            right: -95px;
            width: 320px;
            height: 320px;
            border: 1px solid rgba(166, 126, 67, .13);
            border-radius: 50%;
            box-shadow: 0 0 0 22px rgba(166,126,67,.035), 0 0 0 55px rgba(166,126,67,.025);
            pointer-events: none;
        }
        .nuflo-upload-story {
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.35rem;
        }
        .nuflo-upload-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: .55rem;
            margin-bottom: .65rem;
            color: #92703e;
            font-family: Georgia, "Times New Roman", serif;
            font-size: .72rem;
            font-weight: 700;
            letter-spacing: .19em;
            text-transform: uppercase;
        }
        .nuflo-upload-eyebrow::before {
            content: "";
            width: 25px;
            height: 1px;
            background: #b89255;
        }
        .nuflo-upload-title {
            margin: 0;
            color: #49311f;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(1.65rem, 3vw, 2.45rem);
            font-weight: 500;
            letter-spacing: -.035em;
        }
        .nuflo-upload-description {
            max-width: 46rem;
            margin: .55rem 0 0;
            color: #78634c;
            font-size: .91rem;
            line-height: 1.7;
        }
        .nuflo-upload-status {
            display: inline-flex;
            align-items: center;
            gap: .5rem;
            margin: .8rem 0 0;
            color: #8a765b;
            font-size: .77rem;
            transition: color .2s;
        }
        .nuflo-upload-status::before {
            content: "";
            width: 8px;
            height: 8px;
            border: 1px solid currentColor;
            border-radius: 50%;
            background: rgba(255,255,255,.7);
            box-shadow: 0 0 0 3px rgba(173,133,73,.08);
        }
        .nuflo-upload-status[data-state="dragging"],
        .nuflo-upload-status[data-state="selected"] { color: #6e542f; font-weight: 700; }
        .nuflo-upload-status[data-state="dragging"]::before { background: #bd985b; box-shadow: 0 0 0 4px rgba(173,133,73,.16); }
        .nuflo-upload-status[data-state="selected"]::before { background: #75906b; border-color: #75906b; box-shadow: 0 0 0 4px rgba(117,144,107,.15); }
        .nuflo-upload-seal {
            display: grid;
            width: clamp(70px, 9vw, 104px);
            aspect-ratio: 1;
            place-items: center;
            color: #8e6836;
            border: 1px solid rgba(173, 133, 73, .38);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,.8), rgba(222,196,151,.24));
            box-shadow: 0 0 0 8px rgba(184,146,85,.07), inset 0 1px rgba(255,255,255,.85);
        }
        .nuflo-upload-seal svg { width: 52%; height: 52%; overflow: visible; }
        .nuflo-upload-seal .seal-wave {
            fill: none;
            stroke: currentColor;
            stroke-linecap: round;
            stroke-width: 2;
            stroke-dasharray: 42;
            animation: seal-current 3.2s ease-in-out infinite alternate;
        }
        .nuflo-upload-seal .seal-drop {
            fill: rgba(184, 146, 85, .18);
            stroke: currentColor;
            stroke-width: 1.7;
            transform-origin: center;
            animation: seal-pulse 2.6s ease-in-out infinite;
        }
        #page-nuflo .dropzone {
            position: relative;
            display: grid;
            min-height: clamp(210px, 27vw, 285px);
            place-content: center;
            justify-items: center;
            gap: .35rem;
            overflow: hidden;
            padding: 2rem 1.25rem;
            border: 1px dashed rgba(151, 113, 57, .58);
            border-radius: 21px;
            background:
                radial-gradient(ellipse at 50% 110%, rgba(208, 178, 124, .17), transparent 54%),
                linear-gradient(145deg, rgba(255,255,255,.84), rgba(249,242,228,.84));
            box-shadow: inset 0 0 0 5px rgba(255,255,255,.34), inset 0 18px 44px rgba(170,132,73,.045);
            transition: border-color .28s, background .28s, transform .28s, box-shadow .28s;
        }
        #page-nuflo .dropzone::before,
        #page-nuflo .dropzone::after {
            content: "✦";
            position: absolute;
            top: 50%;
            color: rgba(164, 127, 69, .42);
            font-family: Georgia, "Times New Roman", serif;
            font-size: .85rem;
            transform: translateY(-50%);
            transition: color .28s, transform .28s;
        }
        #page-nuflo .dropzone::before { left: 1.2rem; }
        #page-nuflo .dropzone::after { right: 1.2rem; }
        #page-nuflo .dropzone:hover,
        #page-nuflo .dropzone.dragover {
            border-color: #a6793d;
            background:
                radial-gradient(ellipse at 50% 110%, rgba(208, 178, 124, .25), transparent 54%),
                linear-gradient(145deg, #fffdf8, #f7edda);
            box-shadow: inset 0 0 0 5px rgba(255,255,255,.48), 0 14px 32px rgba(101,70,35,.1);
            transform: translateY(-2px);
        }
        #page-nuflo .dropzone:hover::before,
        #page-nuflo .dropzone.dragover::before { color: #ad854a; transform: translateY(-50%) rotate(-25deg) scale(1.18); }
        #page-nuflo .dropzone:hover::after,
        #page-nuflo .dropzone.dragover::after { color: #ad854a; transform: translateY(-50%) rotate(25deg) scale(1.18); }
        #page-nuflo .dropzone:focus-visible { outline: 3px solid rgba(173,133,73,.58); outline-offset: 4px; }
        #page-nuflo .dropzone-icon {
            display: grid;
            width: 68px;
            height: 68px;
            place-items: center;
            margin-bottom: .65rem;
            color: #8e6836;
            border: 1px solid rgba(173,133,73,.34);
            border-radius: 21px;
            background: linear-gradient(145deg, rgba(255,255,255,.86), rgba(230,211,177,.42));
            box-shadow: 0 10px 24px rgba(105,76,40,.12), inset 0 1px rgba(255,255,255,.9);
            filter: none;
            transition: transform .35s cubic-bezier(.2,.75,.25,1), box-shadow .35s;
        }
        #page-nuflo .dropzone:hover .dropzone-icon,
        #page-nuflo .dropzone.dragover .dropzone-icon { transform: translateY(-4px) rotate(-3deg); box-shadow: 0 15px 28px rgba(105,76,40,.17), inset 0 1px rgba(255,255,255,.9); }
        .dropzone-sigil { width: 42px; height: 42px; overflow: visible; }
        .dropzone-sigil-orbit { fill: none; stroke: rgba(142,104,54,.4); stroke-width: 1; stroke-dasharray: 2 3; transform-origin: center; animation: sigil-orbit 12s linear infinite; }
        .dropzone-sigil-archive { fill: rgba(184,146,85,.2); stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; }
        .dropzone-sigil-arrow { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
        #page-nuflo .dropzone-text {
            max-width: 42rem;
            margin: 0;
            color: #4c3825;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(1rem, 2vw, 1.2rem);
            font-weight: 600;
            line-height: 1.55;
        }
        #page-nuflo .dropzone-hint {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: .45rem;
            margin: .45rem 0 0;
            color: #806b51;
            font-size: .78rem;
        }
        #page-nuflo .dropzone-hint b {
            padding: .18rem .48rem;
            color: #74552e;
            border: 1px solid rgba(173,133,73,.24);
            border-radius: 999px;
            background: rgba(230,211,177,.3);
            font-size: .72rem;
            font-weight: 700;
        }
        .nuflo-upload-steps {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: .7rem;
            margin-top: 1rem;
        }
        .nuflo-upload-step {
            display: flex;
            align-items: center;
            gap: .65rem;
            min-height: 64px;
            padding: .7rem .8rem;
            color: #745f45;
            border: 1px solid rgba(173,133,73,.18);
            border-radius: 14px;
            background: rgba(255,255,255,.47);
            transition: transform .22s, border-color .22s, background .22s;
        }
        .nuflo-upload-step:hover { transform: translateY(-2px); border-color: rgba(173,133,73,.42); background: rgba(255,255,255,.75); }
        .nuflo-upload-step-number {
            display: grid;
            width: 30px;
            height: 30px;
            flex: 0 0 auto;
            place-items: center;
            color: #8b6738;
            border: 1px solid rgba(173,133,73,.3);
            border-radius: 50%;
            background: #fbf5e9;
            font-family: Georgia, "Times New Roman", serif;
            font-size: .76rem;
            font-weight: 700;
        }
        .nuflo-upload-step-text { display: grid; gap: .08rem; font-size: .74rem; line-height: 1.35; }
        .nuflo-upload-step-text strong { color: #503923; font-size: .79rem; }
        .nuflo-upload-trust {
            display: flex;
            align-items: center;
            gap: .45rem;
            margin: .8rem 0 0;
            color: #88765e;
            font-size: .75rem;
        }
        .nuflo-upload-trust::before { content: "◇"; color: #9b7642; font-size: 1rem; }
        #page-nuflo .file-info {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            margin-top: 1rem;
            padding: .9rem 1rem;
            border: 1px solid rgba(173,133,73,.28);
            border-radius: 15px;
            background: linear-gradient(110deg, rgba(255,255,255,.82), rgba(241,228,204,.54));
        }
        #page-nuflo .file-info.hidden { display: none; }
        #page-nuflo #file-name-display { color: #58432c; font-size: .88rem; font-weight: 650; overflow-wrap: anywhere; }
        #page-nuflo #process-btn {
            flex: 0 0 auto;
            padding: .7rem 1.2rem;
            color: #fff8e9;
            border: 1px solid rgba(79,52,28,.42);
            border-radius: 12px;
            background: linear-gradient(145deg, #8e6836, #5b3d25);
            box-shadow: 0 7px 16px rgba(86,57,29,.2), inset 0 1px rgba(255,255,255,.2);
        }
        #page-nuflo #process-btn:hover { background: linear-gradient(145deg, #a07840, #68472a); }
        #page-nuflo .error-text { margin: .8rem 0 0; padding: .75rem .9rem; border: 1px solid rgba(162,63,53,.22); border-radius: 12px; background: rgba(255,239,233,.8); }
        #page-nuflo .upload-mode-toggle:not(.hidden) {
            display: flex;
            flex-wrap: wrap;
            gap: .55rem;
            margin-bottom: 1rem;
            padding: .7rem;
            border: 1px solid rgba(173,133,73,.2);
            border-radius: 14px;
            background: rgba(237,224,199,.38);
        }
        #page-nuflo .upload-mode-toggle .mode-btn { border-color: rgba(173,133,73,.2); color: #705432; background: rgba(255,255,255,.55); }
        #page-nuflo .upload-mode-toggle .mode-btn.active { color: #fff8e9; border-color: #68492b; background: linear-gradient(145deg, #8e6836, #5b3d25); }
        @keyframes seal-current { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 42; } }
        @keyframes seal-pulse { 0%, 100% { transform: scale(.94); opacity: .78; } 50% { transform: scale(1.06); opacity: 1; } }
        @keyframes sigil-orbit { to { transform: rotate(360deg); } }
        @media (max-width: 680px) {
            #page-nuflo #upload-section.upload-card { padding: 1.1rem; border-radius: 20px; }
            .nuflo-upload-story { grid-template-columns: minmax(0, 1fr) auto; gap: .65rem; margin-bottom: 1rem; }
            .nuflo-upload-seal { width: 58px; }
            .nuflo-upload-eyebrow { font-size: .62rem; letter-spacing: .12em; }
            .nuflo-upload-description { font-size: .82rem; }
            #page-nuflo .dropzone { min-height: 205px; padding: 1.5rem .9rem; }
            #page-nuflo .dropzone::before { left: .65rem; }
            #page-nuflo .dropzone::after { right: .65rem; }
            .nuflo-upload-steps { grid-template-columns: 1fr; gap: .45rem; }
            .nuflo-upload-step { min-height: 52px; padding: .55rem .7rem; }
            #page-nuflo .file-info { align-items: stretch; flex-direction: column; }
            .nuflo-upload-status { font-size: .7rem; }
        }

        .btn, .mode-btn, .status-btn, .opm-tab, .press-upload-mode-btn {
            transition: transform .18s ease, box-shadow .18s ease, background .18s ease, border-color .18s ease, color .18s ease;
        }
        .btn { border-radius: 10px; font-weight: 700; }
        .btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 7px 15px rgba(24,48,67,.14); }
        .btn:active:not(:disabled) { transform: translateY(0) scale(.98); }
        .btn-primary { background: linear-gradient(135deg, #183e5c, #245b78); }
        .btn-primary:hover { background: linear-gradient(135deg, #102f49, #1c4a68); }
        .btn-secondary { background: #eaf0f4; color: #29495e; }
        .btn-excel { background: linear-gradient(135deg, #16845b, #1d9a6b); }
        .btn-pdf { background: linear-gradient(135deg, #c73d4b, #df5b5a); }
        .mode-btn { border-radius: 12px; }

        .summary-grid { gap: .9rem; }
        .summary-card {
            position: relative;
            overflow: hidden;
            min-height: 112px;
            padding: 1.2rem 1.25rem;
            border: 1px solid rgba(222, 231, 237, .95);
            border-radius: 16px;
            background: linear-gradient(145deg, #fff 0%, #fbfdfe 100%);
            box-shadow: var(--shadow-card);
            transform-style: preserve-3d;
            will-change: transform;
            transition: box-shadow .25s ease, border-color .25s ease;
        }
        .summary-card::after {
            content: "";
            position: absolute;
            width: 110px; height: 110px;
            right: -46px; bottom: -56px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(63,129,158,.12), transparent 70%);
            pointer-events: none;
        }
        .summary-card h4 { font-size: .72rem; letter-spacing: .075em; }
        .summary-card h2 { font-size: clamp(1.45rem, 2.5vw, 1.9rem); font-weight: 760; }
        .summary-green { border-left: 4px solid var(--green-status-strong); }
        .summary-red { border-left: 4px solid var(--red-status-strong); }
        .summary-money { border-left: 4px solid var(--gold); }
        .stat-card, .press-summary-card, .opm-summary-card {
            border-radius: 15px !important;
            box-shadow: var(--shadow-card) !important;
        }

        .filter-bar { gap: .85rem; align-items: flex-end; }
        .filter-group label, .contract-field label { color: #62798a; font-weight: 700; }
        input, select, textarea, .price-input-wrap {
            border-radius: 10px !important;
            border-color: #d9e3e9 !important;
            background-color: #fff;
        }
        input:focus, select:focus, textarea:focus, button:focus-visible {
            outline: none;
            border-color: #4b91ad !important;
            box-shadow: var(--focus-ring) !important;
        }
        .status-btn { border-radius: 10px; }
        .status-btn.active { box-shadow: inset 0 0 0 1px currentColor; }
        .chart-card .chart-wrap, .press-comp-chart-box, .press-comp-explanation {
            border-radius: 15px;
        }
        .chart-card h3 { margin-bottom: 1rem; }

        .table-card, .invoice-card, .comparison-card { overflow: hidden; }
        .table-card-header { gap: .8rem; }
        .table-scroll, .table-responsive {
            border: 1px solid #e3eaf0;
            border-radius: 13px;
            background: #fff;
            scrollbar-color: #b5c7d2 #f2f6f8;
            scrollbar-width: thin;
        }
        table { font-size: .85rem; }
        thead th {
            padding: .8rem .85rem;
            background: #173b56;
            font-size: .75rem;
            letter-spacing: .025em;
            text-transform: uppercase;
        }
        thead th:hover { background: #245773; }
        tbody td { padding: .72rem .85rem; }
        tbody tr:hover { filter: none; }
        #page-nuflo tbody tr:hover td, #page-pressure tbody tr:hover td {
            box-shadow: inset 0 1px rgba(22,65,92,.07), inset 0 -1px rgba(22,65,92,.07);
        }
        .status-badge { box-shadow: none; letter-spacing: .015em; }
        .status-badge-green { background: #16845b; }
        .status-badge-red { background: #c73d4b; }

        .diagnostic-panel, .history-panel { border-radius: 15px; }
        .diagnostic-header { min-height: 28px; }
        .diagnostic-header:hover h3 { color: #245b78; }
        .diagnostic-body { line-height: 1.65; }
        .diagnostic-body table { border-radius: 10px; overflow: hidden; }

        .ceor-page-header {
            border-radius: 18px;
            background: linear-gradient(120deg, #eaf4f7, #f8fbfc 70%);
            border-color: #d9e8ed;
        }
        .ceor-badge { background: #245b78; }
        #page-ceor .table-responsive { padding: 0; }
        #page-ceor .table th {
            background: #173b56;
            border-color: rgba(255,255,255,.12);
        }
        #page-ceor .table > :not(caption) > * > * { padding: .72rem .85rem; }
        #page-ceor .stat-card { transition: transform .2s, box-shadow .2s; }
        #page-ceor .stat-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-hover) !important; }

        .opm-tab-bar { padding: .35rem; border-radius: 14px; background: rgba(228,236,241,.72); }
        .opm-tab { border-color: transparent; border-radius: 10px; background: transparent; }
        .opm-tab:hover { background: #fff; color: var(--navy); box-shadow: 0 4px 12px rgba(20,46,68,.08); }
        .opm-tab.active { background: #173e5b; color: #fff; box-shadow: 0 5px 13px rgba(16,53,78,.2); }
        .opm-panel { border-radius: 16px; }

        .press-upload-card, .comparison-card { border-radius: var(--radius-card); }
        .press-comp-chart-box { border-color: #e0e9ee; box-shadow: 0 5px 18px rgba(20,46,68,.04); }
        .press-comp-explanation { background: #f3f8fa; border-color: #e0e9ee; }
        .timeline-block { transition: filter .15s, transform .15s; }
        .timeline-block:hover { filter: brightness(.86); transform: scaleY(1.25); }

        .modal-box {
            border: 1px solid rgba(255,255,255,.35);
            border-radius: 18px;
            box-shadow: 0 28px 80px rgba(3,18,32,.34);
        }
        .modal-header { background: linear-gradient(115deg, #123550, #245b78); }
        .page-footer {
            margin-top: 2rem;
            padding: 1.5rem 1rem;
            border-top: 1px solid #dce6ec;
            color: #728797;
            background: rgba(255,255,255,.45);
        }
        .scroll-top-button {
            position: fixed;
            z-index: 120;
            right: 1.25rem;
            bottom: 1.25rem;
            width: 46px;
            height: 46px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(255,255,255,.25);
            border-radius: 15px;
            color: white;
            background: linear-gradient(145deg, #1d4e6b, #102d47);
            box-shadow: 0 10px 24px rgba(16,45,71,.28);
            opacity: 0;
            visibility: hidden;
            transform: translateY(8px);
            transition: opacity .2s, transform .2s, visibility .2s;
            cursor: pointer;
        }
        .scroll-top-button.visible { opacity: 1; visibility: visible; transform: translateY(0); }
        .scroll-top-button:hover { transform: translateY(-3px); }

        @media (max-width: 850px) {
            .topbar { min-height: 100px; padding: 1rem; gap: .8rem; }
            .topbar .logo-wrap { order: 0; padding: .45rem .65rem; }
            .logo-text { font-size: 1.15rem; }
            .logo-sub { display: none; }
            .header-title h1 { font-size: 1.08rem; }
            .header-title p { font-size: .75rem; }
            .header-watermark { display: none; }
            .module-bar { justify-content: flex-start; overflow-x: auto; }
            .module-bar-inner { justify-content: flex-start; width: max-content; min-width: 100%; }
            .module-link { padding: .55rem .75rem; }
            main { padding: 1rem; }
        }
        @media (max-width: 560px) {
            .topbar { flex-wrap: wrap; }
            .header-title { flex: 1 1 calc(100% - 65px); }
            .topbar .logo-wrap { order: 3; }
            .module-link { gap: .35rem; font-size: .76rem; }
            .module-link-icon { font-size: .92rem; }
            .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .summary-card { min-height: 96px; padding: .95rem; }
            .summary-card h4 { font-size: .64rem; }
            .summary-card h2 { font-size: 1.35rem; }
            .filter-bar { align-items: stretch; }
            .filter-group { min-width: 100%; }
            .status-btn-group { flex-wrap: wrap; }
            .export-buttons { flex-wrap: wrap; }
            .table-card-header .export-buttons { width: 100%; }
            .table-card-header .btn { flex: 1; }
            .opm-tab-bar { gap: .25rem; }
            .opm-tab { padding: .5rem .65rem; font-size: .76rem; }
        }
        :root {
            --navy: #4b3021;
            --navy-dark: #2b1a12;
            --navy-light: #76502f;
            --red: #9d4d39;
            --border-color: #e8d8c1;
            --bg-page: #f4eddf;
            --card-bg: rgba(255, 251, 242, .96);
            --text-main: #3a2a1e;
            --text-muted: #83705b;
            --gold: #bd8d43;
            --shadow-soft: 0 10px 30px rgba(75, 48, 33, .08);
            --shadow-card: 0 14px 34px rgba(75, 48, 33, .1), 0 2px 8px rgba(75, 48, 33, .045);
            --shadow-hover: 0 24px 48px rgba(75, 48, 33, .17), 0 6px 14px rgba(75, 48, 33, .08);
            --radius-card: 22px;
            --focus-ring: 0 0 0 4px rgba(189, 141, 67, .23);
        }
        body {
            background:
                radial-gradient(ellipse at 50% -10%, rgba(225, 187, 119, .24), transparent 36rem),
                radial-gradient(ellipse at 0% 48%, rgba(128, 82, 47, .07), transparent 30rem),
                linear-gradient(180deg, #f7f0e3, #f2eadb 54%, #f6f0e5);
            color: #3a2a1e;
        }
        body.story-home { overflow-x: hidden; }
        .topbar {
            min-height: 106px;
            background:
                radial-gradient(ellipse at 78% 15%, rgba(222, 184, 112, .24), transparent 28rem),
                linear-gradient(112deg, #2e1c13, #52351f 54%, #76532e);
            box-shadow: 0 12px 34px rgba(50, 30, 17, .22);
        }
        .topbar::before {
            border-color: rgba(255, 231, 183, .13);
            box-shadow: 0 0 0 38px rgba(255,231,183,.025), 0 0 0 82px rgba(255,231,183,.025);
        }
        .topbar::after {
            background: radial-gradient(circle, rgba(240, 200, 125, .24), transparent 68%);
        }
        .logo-wrap {
            border: 1px solid rgba(180, 130, 65, .24);
            box-shadow: 0 8px 24px rgba(22, 12, 6, .2);
        }
        .header-title h1 { letter-spacing: .015em; }
        .header-title p { color: #ead9bc; }
        .hamburger-btn { display: none; }
        #hamburger-menu, .module-bar { display: none !important; }
        main { max-width: 1440px; min-height: 62vh; }

        .story-home {
            position: relative;
            width: min(100% - 2rem, 1370px);
            margin: clamp(1.6rem, 4vw, 3.7rem) auto 3rem;
            animation: story-arrive .75s cubic-bezier(.2,.75,.25,1) both;
        }
        .story-home::before {
            content: "";
            position: absolute;
            z-index: -1;
            width: 360px; height: 360px;
            top: 70px; right: 0;
            border: 1px solid rgba(169, 123, 61, .14);
            border-radius: 50%;
            box-shadow: 0 0 0 35px rgba(169,123,61,.035), 0 0 0 75px rgba(169,123,61,.025);
            pointer-events: none;
        }
        .story-intro {
            position: relative;
            max-width: 820px;
            margin: 0 auto 2rem;
            text-align: center;
        }
        .story-eyebrow {
            display: inline-flex;
            align-items: center;
            gap: .6rem;
            margin-bottom: .9rem;
            color: #9a6c31;
            font-size: .73rem;
            font-weight: 800;
            letter-spacing: .22em;
            text-transform: uppercase;
        }
        .story-eyebrow::before, .story-eyebrow::after {
            content: "";
            width: 30px; height: 1px;
            background: linear-gradient(90deg, transparent, #bd8d43);
        }
        .story-eyebrow::after { transform: rotate(180deg); }
        .story-title {
            margin: 0;
            color: #442d1c;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(2.15rem, 5vw, 4.5rem);
            font-weight: 500;
            letter-spacing: -.045em;
            line-height: 1.03;
        }
        .story-title em {
            color: #a57738;
            font-weight: 400;
        }
        .story-description {
            max-width: 570px;
            margin: 1rem auto 0;
            color: #7b6851;
            font-size: clamp(.9rem, 1.4vw, 1.03rem);
            line-height: 1.7;
        }
        .story-divider {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: .7rem;
            margin: 1.35rem auto 0;
            color: #bd8d43;
        }
        .story-divider::before, .story-divider::after {
            content: "";
            width: 46px;
            height: 1px;
            background: linear-gradient(90deg, transparent, #c5a06b);
        }
        .story-divider::after { transform: rotate(180deg); }
        .story-chapters {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: clamp(.8rem, 1.7vw, 1.35rem);
            perspective: 1200px;
        }
        .chapter-card {
            --chapter-accent: #ba8b4b;
            --chapter-deep: #694326;
            --tilt-x: 0deg;
            --tilt-y: 0deg;
            --pointer-x: 72%;
            --pointer-y: 28%;
            position: relative;
            display: flex;
            min-height: clamp(275px, 28vw, 360px);
            flex-direction: column;
            align-items: flex-start;
            overflow: hidden;
            padding: clamp(1.1rem, 2vw, 1.55rem);
            color: #fff9ee;
            text-align: left;
            border: 1px solid rgba(255, 247, 225, .27);
            border-radius: 22px;
            background:
                radial-gradient(circle at var(--pointer-x) var(--pointer-y), rgba(255, 241, 204, .26), transparent 36%),
                radial-gradient(circle at 84% 18%, rgba(255,255,255,.22), transparent 32%),
                linear-gradient(152deg, var(--chapter-accent) -10%, var(--chapter-deep) 100%);
            box-shadow: 0 16px 34px rgba(72, 45, 25, .19), inset 0 1px rgba(255,255,255,.3), inset 0 -1px rgba(34,20,9,.16);
            cursor: pointer;
            transform-style: preserve-3d;
            transition: transform .34s cubic-bezier(.2,.75,.25,1), box-shadow .34s, filter .34s;
            isolation: isolate;
        }
        .chapter-card:nth-child(2) { --chapter-accent: #a77342; --chapter-deep: #543923; }
        .chapter-card:nth-child(3) { --chapter-accent: #bd985b; --chapter-deep: #735339; }
        .chapter-card:nth-child(4) { --chapter-accent: #a7775c; --chapter-deep: #513628; }
        .chapter-card::before {
            content: "";
            position: absolute;
            z-index: 0;
            width: 230px; height: 230px;
            right: -75px; top: 45px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255, 239, 207, .1), rgba(255, 239, 207, .035) 58%, transparent 76%);
            box-shadow: 0 0 0 18px rgba(255,245,221,.035), 0 0 0 43px rgba(255,245,221,.025), 0 0 0 72px rgba(255,245,221,.018);
            pointer-events: none;
            transition: width .88s cubic-bezier(.16,.82,.25,1), height .88s cubic-bezier(.16,.82,.25,1), top .88s cubic-bezier(.16,.82,.25,1), left .88s cubic-bezier(.16,.82,.25,1), right .88s cubic-bezier(.16,.82,.25,1), transform .88s cubic-bezier(.16,.82,.25,1);
        }
        .chapter-card::after {
            content: "";
            position: absolute;
            z-index: -1;
            inset: 0;
            opacity: .2;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.18'/%3E%3C/svg%3E");
            mix-blend-mode: soft-light;
            pointer-events: none;
        }
        .chapter-scene {
            position: absolute;
            z-index: 1;
            top: 45px;
            right: -75px;
            width: 230px;
            height: 230px;
            border-radius: 50%;
            overflow: hidden;
            color: rgba(255, 239, 207, .76);
            opacity: .84;
            -webkit-mask-image: radial-gradient(circle, #000 54%, rgba(0,0,0,.92) 69%, transparent 100%);
            mask-image: radial-gradient(circle, #000 54%, rgba(0,0,0,.92) 69%, transparent 100%);
            pointer-events: none;
            transform: translateZ(4px);
            transition: width .88s cubic-bezier(.16,.82,.25,1), height .88s cubic-bezier(.16,.82,.25,1), top .88s cubic-bezier(.16,.82,.25,1), left .88s cubic-bezier(.16,.82,.25,1), right .88s cubic-bezier(.16,.82,.25,1), transform .88s cubic-bezier(.16,.82,.25,1), opacity .3s, filter .3s;
        }
        .chapter-scene svg { display: block; width: 100%; height: 100%; overflow: visible; }
        .chapter-card > :not(.chapter-scene) { position: relative; z-index: 1; }
        .chapter-card:hover .chapter-scene { opacity: 1; filter: drop-shadow(0 5px 10px rgba(255, 225, 173, .18)); }
        .scene-wave {
            fill: rgba(237, 213, 163, .2);
            stroke: none;
            transform-box: fill-box;
            transform-origin: center;
            animation: wave-drift 7s ease-in-out infinite alternate;
        }
        .scene-wave.wave-back { fill: rgba(255, 237, 196, .12); animation-duration: 9s; animation-direction: alternate-reverse; }
        .scene-wave.wave-front { animation-duration: 5.8s; }
        .scene-wave-line {
            fill: none;
            stroke: rgba(255, 240, 208, .66);
            stroke-width: 1.2;
            stroke-linecap: round;
            transform-box: fill-box;
            transform-origin: center;
            animation: wave-drift 7s ease-in-out infinite alternate;
        }
        .scene-wave-line.wave-back { stroke: rgba(255, 240, 208, .34); animation-duration: 9s; animation-direction: alternate-reverse; }
        .scene-wave-line.wave-front { animation-duration: 5.8s; }
        .scene-bubble { fill: rgba(255, 245, 224, .62); animation: bubble-rise 4.8s ease-in-out infinite; }
        .scene-bubble:nth-of-type(2n) { animation-delay: -2.2s; animation-duration: 5.6s; }
        .scene-pressure-line {
            fill: none;
            stroke: rgba(255, 235, 193, .83);
            stroke-width: 2;
            stroke-linecap: round;
            stroke-linejoin: round;
            stroke-dasharray: 6 5;
            animation: pressure-flow 2.8s linear infinite;
        }
        .scene-pressure-line.line-secondary { stroke: rgba(255, 241, 211, .33); stroke-width: 1; stroke-dasharray: 2 7; animation-duration: 4s; }
        .scene-pressure-point { fill: #ffe8b6; filter: drop-shadow(0 0 4px rgba(255,231,182,.8)); animation: point-pulse 1.8s ease-in-out infinite; }
        .scene-orbit {
            fill: none;
            stroke: rgba(255, 239, 207, .45);
            stroke-width: 1;
            stroke-dasharray: 2 5;
            transform-box: fill-box;
            transform-origin: center;
            animation: orbit-spin 15s linear infinite;
        }
        .scene-orbit.orbit-inner { stroke: rgba(255,239,207,.3); animation-duration: 10s; animation-direction: reverse; }
        .scene-node { fill: #f1d39b; stroke: rgba(255,250,231,.75); stroke-width: 1.2; }
        .scene-link { stroke: rgba(255, 239, 207, .45); stroke-width: 1; stroke-dasharray: 3 4; }
        .scene-packet { fill: #fff0c8; filter: drop-shadow(0 0 4px rgba(255,235,185,.8)); animation: packet-travel 3s ease-in-out infinite; }
        .scene-packet.packet-two { animation-delay: -1.5s; }
        .scene-radar-ring {
            fill: none;
            stroke: rgba(255, 237, 201, .4);
            stroke-width: 1;
            transform-box: fill-box;
            transform-origin: center;
            animation: radar-expand 3.4s ease-out infinite;
        }
        .scene-radar-ring.ring-two { animation-delay: -1.7s; }
        .scene-sweep {
            fill: url(#opm-sweep-gradient);
            transform-box: fill-box;
            transform-origin: 50% 50%;
            animation: radar-sweep 7s linear infinite;
        }
        .scene-crosshair { stroke: rgba(255, 244, 221, .5); stroke-width: .8; }
        .scene-target { fill: #ffe3a2; stroke: #fff4d8; stroke-width: 1.2; animation: point-pulse 1.7s ease-in-out infinite; }
        .chapter-card:hover, .chapter-card:focus-visible {
            z-index: 2;
            color: #fff;
            filter: saturate(1.08);
            transform: perspective(900px) translateY(-5px) rotateX(var(--tilt-x)) rotateY(var(--tilt-y)) scale(1.018);
            box-shadow: 0 26px 48px rgba(72, 45, 25, .27), inset 0 1px rgba(255,255,255,.34);
        }
        .chapter-card:hover::before,
        .chapter-card:hover .chapter-scene { transform: translateZ(4px) scale(1.08) translate(-6px, 4px); }
        .chapter-card:focus-visible { outline: 3px solid #d9b66e; outline-offset: 4px; }
        .chapter-number {
            display: inline-flex;
            align-items: center;
            gap: .45rem;
            color: rgba(255, 244, 219, .82);
            font-family: Georgia, "Times New Roman", serif;
            font-size: .77rem;
            letter-spacing: .12em;
        }
        .chapter-number::after { content: ""; width: 27px; height: 1px; background: currentColor; opacity: .65; }
        .chapter-symbol {
            display: grid;
            width: 64px; height: 64px;
            place-items: center;
            margin: auto 0 1.15rem;
            color: #fff4dc;
            font-size: 1.8rem;
            border: 1px solid rgba(255, 245, 220, .34);
            border-radius: 20px;
            background: linear-gradient(145deg, rgba(255,255,255,.2), rgba(255,255,255,.055));
            box-shadow: 0 8px 18px rgba(42, 24, 11, .16), inset 0 1px rgba(255,255,255,.25);
            transform: translateZ(24px);
        }
        .chapter-name {
            margin: 0;
            color: #fff9ee;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(1.55rem, 2.25vw, 2.1rem);
            font-weight: 500;
            letter-spacing: -.025em;
            transform: translateZ(18px);
        }
        .chapter-subtitle {
            margin: .35rem 0 0;
            color: rgba(255, 246, 228, .82);
            font-size: .79rem;
            font-weight: 650;
            letter-spacing: .02em;
            transform: translateZ(13px);
        }
        .chapter-description {
            max-width: 250px;
            margin: .75rem 0 0;
            color: rgba(255, 246, 228, .75);
            font-size: .81rem;
            line-height: 1.55;
            transform: translateZ(10px);
        }
        .chapter-open {
            display: inline-flex;
            align-items: center;
            gap: .45rem;
            margin-top: 1.15rem;
            color: #ffe7b7;
            font-size: .77rem;
            font-weight: 750;
            letter-spacing: .045em;
            transform: translateZ(14px);
        }
        .chapter-open span { transition: transform .2s; }
        .chapter-card:hover .chapter-open span { transform: translateX(5px); }
        .chapter-card.is-launching {
            z-index: 20;
            transform: perspective(900px) translateY(-5px) rotateX(0) rotateY(0) scale(1.025);
            box-shadow: 0 32px 64px rgba(44, 25, 12, .34), inset 0 1px rgba(255,255,255,.4);
        }
        .story-footer {
            margin: 1.4rem auto 0;
            color: #998368;
            font-family: Georgia, "Times New Roman", serif;
            font-size: .8rem;
            font-style: italic;
            text-align: center;
        }
        .story-back {
            position: fixed;
            z-index: 90;
            top: 1rem;
            left: 1rem;
            display: inline-flex;
            align-items: center;
            gap: .55rem;
            min-height: 42px;
            padding: .55rem .95rem;
            color: #fff4df;
            border: 1px solid rgba(255, 239, 207, .3);
            border-radius: 13px;
            background: rgba(61, 39, 23, .86);
            box-shadow: 0 8px 20px rgba(43, 26, 14, .2);
            backdrop-filter: blur(12px);
            cursor: pointer;
            font: inherit;
            font-size: .81rem;
            font-weight: 700;
            transition: transform .2s, background .2s;
        }
        .story-back:hover { background: #51361f; transform: translateY(-2px); }
        body.story-module .topbar { min-height: 92px; padding-left: 5.4rem; }
        body.story-module main { animation: module-arrive .55s cubic-bezier(.2,.75,.25,1) both; }
        .story-surge {
            position: fixed;
            z-index: 10000;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            opacity: 1;
            isolation: isolate;
            transition: opacity 1.05s cubic-bezier(.2,.65,.25,1);
            will-change: opacity;
        }
        .story-surge-wave {
            position: absolute;
            inset: 0 auto 0 0;
            width: 160vw;
            height: 100%;
            transform: translate3d(-105%, 0, 0);
            will-change: transform;
            backface-visibility: hidden;
        }
        .story-surge-wave svg { display: block; width: 100%; height: 100%; }
        .story-surge-wave path {
            transform-box: fill-box;
            transform-origin: center;
            animation: surge-ripple 3.4s ease-in-out infinite alternate;
        }
        .story-surge-wave--deep path { fill: #392519; }
        .story-surge-wave--gold path { fill: rgba(169, 119, 61, .82); }
        .story-surge-wave--glow path { fill: rgba(238, 204, 145, .18); }
        .story-surge.is-entering .story-surge-wave {
            animation: surge-enter 1.35s cubic-bezier(.18,.78,.22,1) forwards;
        }
        .story-surge.is-entering .story-surge-wave--gold { animation-delay: .08s; }
        .story-surge.is-entering .story-surge-wave--glow { animation-delay: .16s; }
        .story-surge.is-covered .story-surge-wave { transform: translate3d(0,0,0); }
        .story-surge::after {
            content: "";
            position: absolute;
            z-index: 1;
            inset: 0;
            opacity: .65;
            background: radial-gradient(ellipse at 50% 48%, rgba(237, 197, 124, .16), transparent 56%);
            animation: surge-glow 3s ease-in-out infinite alternate;
        }
        .story-surge.is-leaving { opacity: 0; }
        .story-surge.is-leaving .story-surge-wave { animation-play-state: paused; }
        .story-surge.is-leaving::after { animation-play-state: paused; }
        .story-surge-scene {
            position: absolute;
            z-index: 2;
            top: 50%;
            left: 50%;
            width: min(62vmin, 560px);
            aspect-ratio: 1;
            border: 1px solid rgba(255, 239, 207, .2);
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255, 239, 207, .12), rgba(57, 37, 25, .08) 60%, transparent 75%);
            box-shadow: 0 0 0 18px rgba(255, 239, 207, .045), 0 0 0 48px rgba(255, 239, 207, .025);
            opacity: 0;
            transform: translate(-50%, -50%) scale(.78);
            transition: opacity .65s ease, transform 1s cubic-bezier(.16,.82,.25,1);
        }
        .story-surge.is-titled .story-surge-scene { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        .story-surge-scene .chapter-scene {
            position: absolute;
            inset: 0;
            top: 0;
            right: auto;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 50%;
            opacity: 1;
            overflow: hidden;
            transform: none;
            -webkit-mask-image: radial-gradient(circle, #000 58%, rgba(0,0,0,.92) 75%, transparent 100%);
            mask-image: radial-gradient(circle, #000 58%, rgba(0,0,0,.92) 75%, transparent 100%);
        }
        .story-surge .chapter-arrival {
            position: absolute;
            z-index: 3;
            inset: 0;
            display: grid;
            align-content: center;
            justify-items: center;
            padding: 2rem;
            text-align: center;
            opacity: 0;
            transform: translateY(12px) scale(.98);
            transition: opacity .5s ease, transform .65s cubic-bezier(.16,.82,.25,1);
        }
        .story-surge.is-titled .chapter-arrival { opacity: 1; transform: translateY(0) scale(1); }
        .chapter-arrival-kicker {
            color: rgba(255, 232, 185, .8);
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(.68rem, 1vw, .82rem);
            letter-spacing: .3em;
            opacity: 0;
            transform: translateY(10px);
            transition: opacity .4s ease, transform .5s ease;
        }
        .story-surge.is-titled .chapter-arrival-kicker { opacity: 1; transform: translateY(0); }
        .chapter-arrival-title {
            margin: .7rem 0 .45rem;
            color: #fff5df;
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(2rem, 7vw, 5.5rem);
            font-weight: 500;
            letter-spacing: .12em;
            text-shadow: 0 4px 28px rgba(255, 224, 166, .28);
        }
        .chapter-arrival-title span { display: inline-block; opacity: 0; transform: translateY(14px) scale(.94); }
        .story-surge.is-titled .chapter-arrival-title span:not(.chapter-arrival-space) {
            animation: inscription-letter .48s calc(var(--letter-index) * 34ms) cubic-bezier(.16,.82,.25,1) forwards;
        }
        .chapter-arrival-title .chapter-arrival-space { width: .32em; }
        .chapter-arrival-subtitle {
            max-width: min(32rem, 80vw);
            margin: 0;
            color: rgba(255, 243, 220, .82);
            font-family: Georgia, "Times New Roman", serif;
            font-size: clamp(.9rem, 1.7vw, 1.1rem);
            font-style: italic;
            letter-spacing: .04em;
            opacity: 0;
            transform: translateY(8px);
            transition: opacity .5s ease .32s, transform .5s ease .32s;
        }
        .story-surge.is-titled .chapter-arrival-subtitle { opacity: 1; transform: translateY(0); }
        .story-surge.is-leaving .chapter-arrival { opacity: 0; transform: translateY(-8px) scale(1.02); }
        .story-home.is-leaving { animation: story-leave .34s ease both; pointer-events: none; }
        .story-home.is-returning { animation: story-return .52s cubic-bezier(.2,.75,.25,1) both; }
        .story-back.is-leaving { opacity: 0; transform: translateY(-8px); transition: opacity .2s, transform .2s; }
        body.story-transitioning { overflow: hidden; }
        @keyframes story-arrive { from { opacity: 0; transform: translateY(20px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes story-leave { to { opacity: 0; transform: translateY(-10px) scale(.99); } }
        @keyframes story-return { from { opacity: 0; transform: translateY(14px) scale(.99); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes module-arrive { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes inscription-letter { to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes surge-enter { to { transform: translate3d(0,0,0); } }
        @keyframes surge-ripple { from { transform: translateY(-.7%) scaleY(.99); } to { transform: translateY(.7%) scaleY(1.01); } }
        @keyframes surge-glow { from { opacity: .32; } to { opacity: .72; } }
        @keyframes wave-drift { from { transform: translateX(-4%) translateY(2%) scaleY(.96); } to { transform: translateX(5%) translateY(-3%) scaleY(1.04); } }
        @keyframes bubble-rise { 0%, 100% { opacity: 0; transform: translateY(8px) scale(.7); } 35%, 70% { opacity: .8; } 75% { opacity: 0; transform: translateY(-25px) scale(1.05); } }
        @keyframes pressure-flow { to { stroke-dashoffset: -44; } }
        @keyframes point-pulse { 0%, 100% { opacity: .55; transform: scale(.88); } 50% { opacity: 1; transform: scale(1.15); } }
        @keyframes orbit-spin { to { transform: rotate(360deg); } }
        @keyframes packet-travel { 0%, 100% { transform: translate(0, 0); opacity: .35; } 50% { transform: translate(20px, -11px); opacity: 1; } }
        @keyframes radar-expand { 0% { opacity: .7; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.75); } }
        @keyframes radar-sweep { to { transform: rotate(360deg); } }
        @media (max-width: 950px) {
            .story-chapters { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .chapter-card { min-height: 280px; }
        }
        @media (max-width: 600px) {
            .story-home { width: min(100% - 1.25rem, 500px); margin-top: 1.5rem; }
            .story-intro { margin-bottom: 1.35rem; }
            .story-title { font-size: clamp(2.2rem, 11vw, 3.4rem); }
            .story-chapters { grid-template-columns: 1fr; gap: .85rem; }
            .chapter-card { min-height: 218px; padding: 1.1rem; }
            .chapter-symbol { width: 52px; height: 52px; margin-top: 1.2rem; margin-bottom: .7rem; border-radius: 16px; }
            .chapter-description { margin-top: .45rem; }
            .chapter-open { margin-top: .75rem; }
            body.story-module .topbar { min-height: 94px; padding: 1rem 1rem 1rem 4.6rem; }
            .story-back { top: .8rem; left: .7rem; min-height: 38px; padding: .45rem .7rem; font-size: .74rem; }
            .chapter-arrival { padding: 1.25rem; }
            .chapter-arrival-title { font-size: clamp(1.8rem, 10vw, 3.5rem); }
        }
    `;

    const styleElement = document.createElement('style');
    styleElement.id = 'dashboard-interactive-style';
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    const nufloUploadSection = document.getElementById('upload-section');
    const nufloDropzone = document.getElementById('dropzone');
    const nufloFileInfo = document.getElementById('file-info');
    if (nufloUploadSection && nufloDropzone && nufloFileInfo) {
        const uploadStory = document.createElement('header');
        uploadStory.className = 'nuflo-upload-story';
        uploadStory.innerHTML = `
            <div>
                <span class="nuflo-upload-eyebrow">BAB 01 · ARSIP TELEMETRI</span>
                <h2 class="nuflo-upload-title">Buka gerbang data NUFLO</h2>
                <p class="nuflo-upload-description">Masukkan catatan mentah sumur untuk memulai pemeriksaan availability. Beberapa berkas dalam satu periode dapat dipilih sekaligus dan akan digabung otomatis.</p>
                <p class="nuflo-upload-status" data-state="waiting" role="status" aria-live="polite">Menunggu berkas untuk diperiksa.</p>
            </div>
            <span class="nuflo-upload-seal" aria-hidden="true">
                <svg viewBox="0 0 48 48">
                    <circle class="dropzone-sigil-orbit" cx="24" cy="24" r="21"/>
                    <path class="seal-drop" d="M24 9C20 15 15 20 15 27a9 9 0 0 0 18 0c0-7-5-12-9-18Z"/>
                    <path class="seal-wave" d="M12 29c4-3 8 3 12 0s8-3 12 0M15 35c3-2 6 2 9 0s6-2 9 0"/>
                </svg>
            </span>
        `;
        nufloUploadSection.insertBefore(uploadStory, nufloDropzone);

        const dropzoneIcon = nufloDropzone.querySelector('.dropzone-icon');
        if (dropzoneIcon) {
            dropzoneIcon.innerHTML = `
                <svg class="dropzone-sigil" viewBox="0 0 48 48" aria-hidden="true">
                    <circle class="dropzone-sigil-orbit" cx="24" cy="24" r="21"/>
                    <path class="dropzone-sigil-archive" d="M10 18h11l3 3h14v16H10z"/>
                    <path class="dropzone-sigil-arrow" d="M24 31V22m0 0-4 4m4-4 4 4M18 35h12"/>
                </svg>
            `;
        }

        const steps = document.createElement('div');
        steps.className = 'nuflo-upload-steps';
        steps.setAttribute('aria-label', 'Tahapan pengolahan data');
        steps.innerHTML = `
            <div class="nuflo-upload-step">
                <span class="nuflo-upload-step-number">01</span>
                <span class="nuflo-upload-step-text"><strong>Pilih catatan</strong><span>Seret atau buka berkas mentah.</span></span>
            </div>
            <div class="nuflo-upload-step">
                <span class="nuflo-upload-step-number">02</span>
                <span class="nuflo-upload-step-text"><strong>Gabungkan sumber</strong><span>Unggah beberapa file sekaligus.</span></span>
            </div>
            <div class="nuflo-upload-step">
                <span class="nuflo-upload-step-number">03</span>
                <span class="nuflo-upload-step-text"><strong>Mulai pemeriksaan</strong><span>Tinjau hasil sebelum membuat rekap.</span></span>
            </div>
        `;
        nufloDropzone.insertAdjacentElement('afterend', steps);

        const trustNote = document.createElement('p');
        trustNote.className = 'nuflo-upload-trust';
        trustNote.textContent = 'Berkas diproses di dashboard ini; hasilnya tidak disimpan sebagai arsip permanen.';
        steps.insertAdjacentElement('afterend', trustNote);

        const fileInput = document.getElementById('file-input');
        const uploadStatus = uploadStory.querySelector('.nuflo-upload-status');
        nufloDropzone.setAttribute('role', 'button');
        nufloDropzone.setAttribute('tabindex', '0');
        nufloDropzone.setAttribute('aria-label', 'Pilih atau seret file NUFLO berformat XLS, XLSX, atau CSV');
        if (fileInput) fileInput.setAttribute('aria-label', 'Pilih file data mentah NUFLO');
        nufloDropzone.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            fileInput?.click();
        });
        nufloDropzone.addEventListener('dragover', () => {
            uploadStatus.dataset.state = 'dragging';
            uploadStatus.textContent = 'Lepaskan berkas untuk menambahkan ke arsip.';
        });
        nufloDropzone.addEventListener('dragleave', () => {
            if (nufloFileInfo.classList.contains('hidden')) {
                uploadStatus.dataset.state = 'waiting';
                uploadStatus.textContent = 'Menunggu berkas untuk diperiksa.';
            }
        });

        const syncUploadStatus = () => {
            const hasFiles = !nufloFileInfo.classList.contains('hidden');
            uploadStatus.dataset.state = hasFiles ? 'selected' : 'waiting';
            uploadStatus.textContent = hasFiles
                ? 'Berkas siap ditinjau sebelum proses dimulai.'
                : 'Menunggu berkas untuk diperiksa.';
        };
        new MutationObserver(syncUploadStatus).observe(nufloFileInfo, { attributes: true, attributeFilter: ['class'] });
        syncUploadStatus();
    }

    const modules = [
        {
            id: 'nuflo', icon: '💧', number: '01', label: 'NUFLO',
            subtitle: 'Availability & billing sumur',
            description: 'Mengolah data sumur menjadi ringkasan availability dan hari yang dapat ditagihkan.',
            scene: `<svg viewBox="0 0 240 150" aria-hidden="true">
                <path class="scene-wave wave-back" d="M0 84 C35 70 57 96 91 83 S147 68 180 83 S220 95 250 77 V160 H0Z"/>
                <path class="scene-wave" d="M0 98 C35 83 61 105 97 94 S157 81 188 95 S222 104 250 91 V160 H0Z"/>
                <path class="scene-wave wave-front" d="M0 113 C34 101 59 118 96 109 S154 96 191 109 S224 119 250 106 V160 H0Z"/>
                <path class="scene-wave-line wave-back" d="M0 84 C35 70 57 96 91 83 S147 68 180 83 S220 95 250 77"/>
                <path class="scene-wave-line" d="M0 98 C35 83 61 105 97 94 S157 81 188 95 S222 104 250 91"/>
                <path class="scene-wave-line wave-front" d="M0 113 C34 101 59 118 96 109 S154 96 191 109 S224 119 250 106"/>
                <circle class="scene-bubble" cx="82" cy="79" r="2.4"/><circle class="scene-bubble" cx="145" cy="70" r="1.8"/>
                <circle class="scene-bubble" cx="186" cy="87" r="2.1"/>
            </svg>`
        },
        {
            id: 'pressure', icon: '📉', number: '02', label: 'Pressure',
            subtitle: 'Mobilkom & mitra',
            description: 'Membaca data tekanan dan menyandingkan hasil dua sumber untuk pemeriksaan silang.',
            scene: `<svg viewBox="0 0 240 150" aria-hidden="true">
                <path class="scene-pressure-line line-secondary" d="M2 106 H238"/><path class="scene-pressure-line line-secondary" d="M2 70 H238"/>
                <path class="scene-pressure-line" d="M4 99 L37 99 L53 90 L68 106 L85 56 L103 112 L119 86 L139 92 L155 50 L172 103 L192 80 L211 88 L235 66"/>
                <circle class="scene-pressure-point" cx="85" cy="56" r="3"/>
                <circle class="scene-pressure-point" cx="155" cy="50" r="3" style="animation-delay:-.8s"/>
                <path d="M25 39h190 M25 121h190" stroke="rgba(255,239,207,.2)" stroke-width="1"/>
            </svg>`
        },
        {
            id: 'ceor', icon: '🧮', number: '03', label: 'CEOR',
            subtitle: 'Pressure & flow telemetry',
            description: 'Merangkum rekaman telemetri per Node ID dan periode pengamatan.',
            scene: `<svg viewBox="0 0 240 150" aria-hidden="true">
                <ellipse class="scene-orbit" cx="145" cy="77" rx="77" ry="30"/><ellipse class="scene-orbit orbit-inner" cx="145" cy="77" rx="54" ry="45"/>
                <path class="scene-link" d="M91 74 L145 77 L194 49 M145 77 L184 111 M145 77 L99 111"/>
                <circle class="scene-node" cx="145" cy="77" r="7"/><circle class="scene-node" cx="91" cy="74" r="4"/>
                <circle class="scene-node" cx="194" cy="49" r="4"/><circle class="scene-node" cx="184" cy="111" r="4"/>
                <circle class="scene-node" cx="99" cy="111" r="4"/><circle class="scene-packet" cx="114" cy="73" r="2.5"/>
                <circle class="scene-packet packet-two" cx="171" cy="62" r="2.5"/>
                <circle cx="145" cy="77" r="15" fill="none" stroke="rgba(255,239,207,.28)" stroke-width="1"/>
            </svg>`
        },
        {
            id: 'opm', icon: '🔍', number: '04', label: 'OPM',
            subtitle: 'Verification & compliance',
            description: 'Meninjau status verifikasi RTU serta parameter operasional.',
            scene: `<svg viewBox="0 0 240 150" aria-hidden="true">
                <defs><linearGradient id="opm-sweep-gradient" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff0ca" stop-opacity=".38"/><stop offset="1" stop-color="#fff0ca" stop-opacity="0"/></linearGradient></defs>
                <circle class="scene-radar-ring" cx="145" cy="78" r="53"/><circle class="scene-radar-ring ring-two" cx="145" cy="78" r="53"/>
                <path class="scene-sweep" d="M145 78 L145 21 A57 57 0 0 1 197 55 Z"/>
                <circle class="scene-crosshair" cx="145" cy="78" r="38" fill="none"/><path class="scene-crosshair" d="M88 78h114 M145 21v114"/>
                <circle class="scene-target" cx="172" cy="55" r="4"/>
                <path d="M169 55l2 2 4-5" fill="none" stroke="#593c25" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="119" cy="94" r="2.5" fill="rgba(255,236,196,.68)"/>
            </svg>`
        }
    ];
    const header = document.querySelector('.topbar');
    const originalMenuItems = [...document.querySelectorAll('.menu-item')];
    const oldModuleBar = document.querySelector('.module-bar');
    if (oldModuleBar) oldModuleBar.remove();

    const home = document.createElement('section');
    home.className = 'story-home';
    home.id = 'story-home';
    home.setAttribute('aria-label', 'Pilih modul dashboard');
    home.innerHTML = `
        <header class="story-intro">
            <div class="story-eyebrow">Mobilkom · Telemetry dashboard</div>
            <h2 class="story-title">Setiap data punya<br><em>ceritanya sendiri.</em></h2>
            <p class="story-description">Pilih satu bab untuk mulai membaca, mengolah, dan merangkum data operasional.</p>
            <div class="story-divider" aria-hidden="true">✦</div>
        </header>
        <div class="story-chapters">${modules.map(module => `
            <button type="button" class="chapter-card" data-open-module="${module.id}" aria-label="Buka modul ${module.label}: ${module.subtitle}">
                <span class="chapter-number">BAB ${module.number}</span>
                <span class="chapter-scene" aria-hidden="true">${module.scene}</span>
                <span class="chapter-symbol" aria-hidden="true">${module.icon}</span>
                <span class="chapter-name">${module.label}</span>
                <span class="chapter-subtitle">${module.subtitle}</span>
                <span class="chapter-description">${module.description}</span>
                <span class="chapter-open">Buka bab <span aria-hidden="true">→</span></span>
            </button>
        `).join('')}</div>
        <p class="story-footer">Empat alur kerja. Satu ruang untuk memahami data.</p>
    `;
    header.insertAdjacentElement('afterend', home);
    document.body.classList.add('story-home');
    document.getElementById('page-header-title').textContent = 'Mobilkom · Telemetry Stories';
    document.getElementById('page-header-subtitle').textContent = 'Pilih modul untuk membuka alur kerja data';
    document.title = 'Telemetry Stories — PT Mobilkom';

    const pageElements = new Map(modules.map(module => [module.id, document.getElementById(`page-${module.id}`)]));
    pageElements.forEach(page => page && page.classList.add('hidden'));

    const backButton = document.createElement('button');
    backButton.type = 'button';
    backButton.className = 'story-back hidden';
    backButton.innerHTML = '<span aria-hidden="true">←</span><span>Semua bab</span>';
    backButton.setAttribute('aria-label', 'Kembali ke semua modul');
    document.body.appendChild(backButton);

    const getTransitionTiming = () => {
        const isCompact = window.matchMedia('(max-width: 600px)').matches;
        return {
            entrance: isCompact ? 1450 : 1510,
            titleDelay: isCompact ? 80 : 100,
            titleReveal: 900,
            hold: isCompact ? 1050 : 1250,
            reveal: isCompact ? 900 : 1050
        };
    };
    let isTransitioning = false;

    const setActiveModule = moduleId => {
        pageElements.forEach((page, id) => {
            if (!page) return;
            page.classList.toggle('hidden', id !== moduleId);
            page.setAttribute('aria-hidden', String(id !== moduleId));
        });
        document.body.classList.remove('story-home');
        document.body.classList.add('story-module');
        home.classList.add('hidden');
        backButton.classList.remove('hidden');
        const legacyMenuItem = originalMenuItems.find(item => item.dataset.page === moduleId);
        if (legacyMenuItem) legacyMenuItem.click();
        document.title = `${document.getElementById('page-header-title').textContent} — PT Mobilkom`;
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    const returnHome = () => {
        pageElements.forEach(page => {
            if (!page) return;
            page.classList.add('hidden');
            page.setAttribute('aria-hidden', 'true');
        });
        backButton.classList.add('hidden');
        document.body.classList.remove('story-module');
        document.body.classList.add('story-home');
        home.classList.remove('hidden', 'is-leaving');
        home.classList.add('is-returning');
        window.setTimeout(() => home.classList.remove('is-returning'), 600);
        document.getElementById('page-header-title').textContent = 'Mobilkom · Telemetry Stories';
        document.getElementById('page-header-subtitle').textContent = 'Pilih modul untuk membuka alur kerja data';
        document.title = 'Telemetry Stories — PT Mobilkom';
        window.scrollTo({ top: 0, behavior: 'auto' });
    };

    home.querySelectorAll('.chapter-card').forEach(card => {
        card.addEventListener('click', () => {
            const moduleId = card.dataset.openModule;
            if (isTransitioning || !pageElements.get(moduleId)) return;
            const timing = getTransitionTiming();

            isTransitioning = true;
            document.body.classList.add('story-transitioning');
            const surge = document.createElement('div');
            surge.className = 'story-surge';
            surge.setAttribute('aria-hidden', 'true');
            surge.innerHTML = `
                <div class="story-surge-wave story-surge-wave--deep">
                    <svg viewBox="0 0 1600 1000" preserveAspectRatio="none"><path d="M0 0H1420C1370 120 1510 210 1400 330S1515 545 1385 675S1510 875 1410 1000H0Z"/></svg>
                </div>
                <div class="story-surge-wave story-surge-wave--gold">
                    <svg viewBox="0 0 1600 1000" preserveAspectRatio="none"><path d="M0 0H1385C1325 130 1465 225 1360 355S1475 550 1355 700S1470 875 1380 1000H0Z"/></svg>
                </div>
                <div class="story-surge-wave story-surge-wave--glow">
                    <svg viewBox="0 0 1600 1000" preserveAspectRatio="none"><path d="M0 0H1345C1290 145 1435 245 1325 375S1450 570 1320 725S1440 890 1340 1000H0Z"/></svg>
                </div>
            `;
            const sceneFrame = document.createElement('div');
            sceneFrame.className = 'story-surge-scene';
            const scene = card.querySelector('.chapter-scene').cloneNode(true);
            const sweepGradient = scene.querySelector('#opm-sweep-gradient');
            if (sweepGradient) {
                sweepGradient.id = `opm-sweep-gradient-${moduleId}-transition`;
                scene.querySelector('.scene-sweep')?.style.setProperty('fill', `url(#${sweepGradient.id})`);
            }
            sceneFrame.appendChild(scene);
            surge.appendChild(sceneFrame);
            const arrival = document.createElement('div');
            arrival.className = 'chapter-arrival';
            const arrivalContent = document.createElement('div');
            arrivalContent.className = 'chapter-arrival-content';
            const kicker = document.createElement('span');
            kicker.className = 'chapter-arrival-kicker';
            kicker.textContent = 'SEBUAH BAB BARU';
            const arrivalTitle = document.createElement('h2');
            arrivalTitle.className = 'chapter-arrival-title';
            Array.from(card.querySelector('.chapter-name').textContent).forEach((character, index) => {
                const letter = document.createElement('span');
                letter.textContent = character === ' ' ? '\u00a0' : character;
                letter.style.setProperty('--letter-index', index);
                if (character === ' ') letter.className = 'chapter-arrival-space';
                arrivalTitle.appendChild(letter);
            });
            const arrivalSubtitle = document.createElement('p');
            arrivalSubtitle.className = 'chapter-arrival-subtitle';
            arrivalSubtitle.textContent = card.querySelector('.chapter-subtitle').textContent;
            arrivalContent.append(kicker, arrivalTitle, arrivalSubtitle);
            arrival.appendChild(arrivalContent);
            surge.appendChild(arrival);
            document.documentElement.appendChild(surge);
            card.classList.add('is-launching');
            home.classList.add('is-leaving');

            requestAnimationFrame(() => requestAnimationFrame(() => surge.classList.add('is-entering')));

            window.setTimeout(() => {
                surge.classList.add('is-covered', 'is-titled');
            }, timing.entrance + timing.titleDelay);
            window.setTimeout(() => {
                setActiveModule(moduleId);
                surge.classList.add('is-leaving');
                window.setTimeout(() => {
                    surge.remove();
                    card.classList.remove('is-launching');
                    home.classList.remove('is-leaving');
                    document.body.classList.remove('story-transitioning');
                    isTransitioning = false;
                }, timing.reveal);
            }, timing.entrance + timing.titleDelay + timing.titleReveal + timing.hold);
        });
    });

    backButton.addEventListener('click', returnHome);
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && document.body.classList.contains('story-module')) returnHome();
    });

    const scrollTopButton = document.createElement('button');
    scrollTopButton.type = 'button';
    scrollTopButton.className = 'scroll-top-button';
    scrollTopButton.setAttribute('aria-label', 'Kembali ke atas');
    scrollTopButton.title = 'Kembali ke atas';
    scrollTopButton.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
    document.body.appendChild(scrollTopButton);
    scrollTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const updateScrollButton = () => scrollTopButton.classList.toggle('visible', window.scrollY > 420);
    window.addEventListener('scroll', updateScrollButton, { passive: true });
    updateScrollButton();

    document.addEventListener('pointermove', event => {
            const card = event.target.closest('.chapter-card, .summary-card');
            document.querySelectorAll('.chapter-card.is-tilting, .summary-card.is-tilting').forEach(activeCard => {
                if (activeCard !== card) {
                    activeCard.classList.remove('is-tilting');
                    activeCard.style.transform = '';
                    activeCard.style.boxShadow = '';
                    activeCard.style.removeProperty('--tilt-x');
                    activeCard.style.removeProperty('--tilt-y');
                }
            });
            if (!card) return;
            const bounds = card.getBoundingClientRect();
            const x = (event.clientX - bounds.left) / bounds.width;
            const y = (event.clientY - bounds.top) / bounds.height;
            const rotateY = (x - .5) * (card.classList.contains('chapter-card') ? 8 : 4);
            const rotateX = (.5 - y) * (card.classList.contains('chapter-card') ? 8 : 4);
            card.classList.add('is-tilting');
            if (card.classList.contains('chapter-card')) {
                card.style.setProperty('--tilt-x', `${rotateX}deg`);
                card.style.setProperty('--tilt-y', `${rotateY}deg`);
                card.style.setProperty('--pointer-x', `${x * 100}%`);
                card.style.setProperty('--pointer-y', `${y * 100}%`);
            } else {
                card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
                card.style.boxShadow = 'var(--shadow-hover)';
            }
    });
    document.addEventListener('pointerout', event => {
            const card = event.target.closest('.chapter-card, .summary-card');
            if (!card || card.contains(event.relatedTarget)) return;
            card.classList.remove('is-tilting');
            card.style.transform = '';
            card.style.boxShadow = '';
            card.style.removeProperty('--tilt-x');
            card.style.removeProperty('--tilt-y');
            card.style.removeProperty('--pointer-x');
            card.style.removeProperty('--pointer-y');
    });
})();
