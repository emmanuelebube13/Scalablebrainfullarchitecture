"""Builds data-model/blueprint.html: the conceptual, logical and physical models and the data flow diagrams.

Run:  C:\\SB\\venv-s1\\Scripts\\python.exe data-model\\tools\\build_blueprint.py
Pure standard library. Edit the lists below, run again, republish.
"""
from html import escape as esc
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "blueprint.html"


# ---------------------------------------------------------------- svg helpers
def defs(p):
    out = ["<defs>"]
    for name in ("", "spine", "warn", "bad", "off"):
        out.append(
            f'<marker id="{p}{name or "a"}" viewBox="0 0 8 8" refX="7.2" refY="4" markerWidth="7" '
            f'markerHeight="7" orient="auto-start-reverse"><path d="M0,0.6 L8,4 L0,7.4 z" class="mh {name}"/></marker>'
        )
    out.append("</defs>")
    return "".join(out)


def arrow(p, pts, cls="", both=False, head=True):
    mk = cls.split()[0] if cls else "a"
    d = "M" + " L".join(f"{x},{y}" for x, y in pts)
    a = f' marker-end="url(#{p}{mk})"' if head else ""
    if both:
        a += f' marker-start="url(#{p}{mk})"'
    return f'<path d="{d}" class="e {cls}" fill="none"{a}/>'


def label(x, y, text, anchor="middle", cls=""):
    return f'<text x="{x}" y="{y}" text-anchor="{anchor}" class="el {cls}">{esc(text)}</text>'


def badge(x, y, n, cls="warn"):
    return (f'<circle cx="{x}" cy="{y}" r="10" class="bd {cls}"/>'
            f'<text x="{x}" y="{y + 4}" text-anchor="middle" class="bt">{n}</text>')


# ---------------------------------------------------------------- figure 1: conceptual model
def conceptual():
    p = "c"
    X = [30, 234, 438, 642, 846, 1050]
    Y = [50, 180, 330, 480, 610]
    W, H = 140, 54
    ents = [  # col, row, name, domain, spine
        (0, 0, "Backtest Run", "Research", 0), (1, 0, "Card", "Research", 0),
        (2, 0, "Incubation", "Research", 0), (3, 0, "Forward Trade", "Research", 0),
        (4, 0, "Environment", "Reference", 0),
        (0, 1, "Strategy Version", "Reference", 0), (1, 1, "Strategy", "Reference", 0),
        (2, 1, "Risk Setting", "Reference", 0), (3, 1, "Equity Sample", "Account state", 0),
        (4, 1, "Account", "Reference", 0), (5, 1, "Broker", "Reference", 0),
        (0, 2, "External Data", "Market", 0), (1, 2, "Signal", "Trade path", 1),
        (2, 2, "Risk Decision", "Trade path", 1), (3, 2, "Order", "Trade path", 1),
        (4, 2, "Fill", "Trade path", 1), (5, 2, "Trade", "Trade path", 1),
        (0, 3, "Price Bar", "Market", 0), (1, 3, "Instrument", "Reference", 0),
        (2, 3, "Regime", "Market", 0), (3, 3, "Service", "Operations", 0),
        (4, 3, "Alert", "Operations", 0), (5, 3, "Operator Command", "Operations", 0),
        (3, 4, "Heartbeat", "Operations", 0),
    ]
    s = [f'<svg viewBox="0 0 1224 690" role="img" aria-label="Conceptual model: 24 business entities in six '
         f'domains. A strategy produces a signal; the signal is judged by a risk decision, which approves an order; '
         f'the order is filled, and fills update a trade held in an account.">', defs(p)]

    def h(c0, c1, r, text, cls="", dy=27):  # horizontal edge between adjacent columns
        y = Y[r] + dy
        if c1 > c0:
            x1, x2 = X[c0] + W, X[c1]
        else:
            x1, x2 = X[c0], X[c1] + W
        s.append(arrow(p, [(x1, y), (x2, y)], cls))
        s.append(label((x1 + x2) / 2, y - 7, text))

    def v(c, r0, r1, text, cls="", side="r"):  # vertical edge between adjacent rows
        x = X[c] + W / 2
        if r1 > r0:
            y1, y2 = Y[r0] + H, Y[r1]
        else:
            y1, y2 = Y[r0], Y[r1] + H
        s.append(arrow(p, [(x, y1), (x, y2)], cls))
        if side == "r":
            s.append(label(x + 7, (y1 + y2) / 2 + 4, text, "start"))
        else:
            s.append(label(x - 7, (y1 + y2) / 2 + 4, text, "end"))

    v(0, 0, 1, "tests")
    v(1, 0, 1, "registers")
    s.append(arrow(p, [(458, 104), (366, 180)])); s.append(label(424, 146, "enrols", "start"))
    h(2, 3, 0, "records")
    h(1, 0, 1, "has")
    h(1, 2, 1, "has")
    v(1, 1, 2, "produces")
    v(2, 2, 1, "applies")
    for c0, t in ((0, "informs"), (1, "judged by"), (2, "approves"), (3, "filled as"), (4, "updates")):
        h(c0, c0 + 1, 2, t, "spine" if c0 else "")
    s.append(arrow(p, [(740, 330), (880, 234)])); s.append(label(806, 279, "placed on", "end"))
    s.append(arrow(p, [(1090, 330), (950, 234)])); s.append(label(1028, 279, "held in", "start"))
    h(4, 5, 1, "held at")
    h(4, 3, 1, "sampled")
    v(4, 1, 0, "runs in")
    v(1, 2, 3, "is for")
    h(0, 1, 3, "of")
    h(2, 1, 3, "labels")
    s.append(arrow(p, [(480, 480), (360, 384)])); s.append(label(436, 440, "context for", "start"))
    h(3, 4, 3, "raises")
    v(3, 3, 4, "emits")
    v(5, 3, 2, "closes, adjusts", side="l")

    for c, r, name, dom, spine in ents:
        x, y = X[c], Y[r]
        s.append(f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="6" class="n{" spine" if spine else ""}"/>')
        s.append(f'<text x="{x + 12}" y="{y + 20}" class="eb">{esc(dom)}</text>')
        s.append(f'<text x="{x + 12}" y="{y + 40}" class="nm">{esc(name)}</text>')
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- figure 2: context (level 0)
def context():
    p = "x"
    s = [f'<svg viewBox="0 0 1224 500" role="img" aria-label="Context diagram: Scalable Brain in the centre. '
         f'Prices, account data and fills come in from the OANDA practice account and orders go out to it. Public data '
         f'sources and a model hub feed it. It serves the owner and a public status page. Alerts to Telegram are not '
         f'delivered. The live account and prop firms are not connected.">', defs(p)]

    def ext(x, y, name, sub, cls=""):
        s.append(f'<rect x="{x}" y="{y}" width="220" height="56" class="x {cls}"/>')
        s.append(f'<text x="{x + 14}" y="{y + 24}" class="nm">{esc(name)}</text>')
        s.append(f'<text x="{x + 14}" y="{y + 42}" class="sb">{esc(sub)}</text>')

    def flow(side, y, text, to_center=True, cls="", head=True):
        a, b = (250, 472) if side == "l" else (752, 974)
        pts = [(a, y), (b, y)]
        if (side == "l") != to_center:
            pts.reverse()
        s.append(arrow(p, pts, cls, head=head))
        s.append(label((a + b) / 2, y - 7, text, cls=cls))

    s.append('<rect x="472" y="30" width="280" height="440" rx="10" class="core"/>')
    s.append('<text x="612" y="72" text-anchor="middle" class="ttl">Scalable Brain</text>')
    s.append('<text x="612" y="94" text-anchor="middle" class="sb">one Windows PC, one PostgreSQL server</text>')
    parts = [("s1", "System 1 Brain", "prices, signals, models"), ("s3", "System 3 Guardian", "risk gate, journal"),
             ("s2", "System 2 Hand", "order execution"), ("", "Bridge", "translation, account state"),
             ("", "Research", "backtests, forward ledger"), ("", "Dashboard, control panel", "view and control"),
             ("", "Stores", "3 databases, 9+ SQLite files")]
    for i, (c, n, d) in enumerate(parts):
        y = 140 + i * 44
        s.append(f'<circle cx="502" cy="{y - 4}" r="4" class="dot {c}"/>')
        s.append(f'<text x="516" y="{y}" class="nm {c}">{esc(n)}</text>')
        s.append(f'<text x="516" y="{y + 16}" class="sb">{esc(d)}</text>')

    ext(30, 72, "OANDA practice", "demo broker account")
    flow("l", 88, "candles, prices, account, fills")
    flow("l", 114, "orders, stop changes, closes", to_center=False)
    ext(30, 222, "Public data sources", "FRED, central banks, CFTC, calendar")
    flow("l", 250, "macro, calendar, positioning")
    ext(30, 372, "Model hub", "Hugging Face text models")
    flow("l", 400, "model weights")

    ext(974, 36, "Owner", "browser, phone on a private network")
    flow("r", 52, "dashboard, bell, control panel", to_center=False)
    flow("r", 78, "controls, commands, deploys")
    ext(974, 124, "Public status page", "GitHub, open to the web")
    flow("r", 152, "status file, every 5 min", to_center=False)
    ext(974, 212, "Telegram", "phone alerts", "bad")
    flow("r", 240, "alerts: 290 queued, 0 delivered", to_center=False, cls="bad")
    ext(974, 300, "OANDA live", "real-money account", "off")
    flow("r", 328, "read-only, not set up", cls="off")
    ext(974, 388, "Prop firms", "future accounts", "off")
    flow("r", 416, "not built", cls="off", head=False)
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- figure 3: data flow (level 1)
def flow1():
    p = "f"
    H = 64
    R = [36, 150, 366, 486, 606, 726]
    s = [f'<svg viewBox="0 0 1224 930" role="img" aria-label="Data flow as it runs today. Prices are ingested into '
         f'ForexBrainDB; System 1 and a research emitter publish signals onto one SQLite queue; the Guardian risk gate, '
         f'the bridge and the execution service exchange orders and fills over the same queue; execution talks to the '
         f'broker. Copy jobs move trades into the dashboard database. Nine numbered trouble spots are marked.">', defs(p)]

    def proc(x, y, w, title, sub="", sub2="", sysc=""):
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{H}" rx="12" class="pr"/>')
        s.append(f'<text x="{x + 14}" y="{y + 23}" class="nm">{esc(title)}</text>')
        if sub:
            s.append(f'<text x="{x + 14}" y="{y + 40}" class="sb {sysc}">{esc(sub)}</text>')
        if sub2:
            s.append(f'<text x="{x + 14}" y="{y + 54}" class="sb">{esc(sub2)}</text>')

    def store(x, y, w, sid, title, sub="", h=H, mono=True):
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="st"/>')
        s.append(f'<rect x="{x}" y="{y}" width="30" height="{h}" class="stid"/>')
        s.append(f'<path d="M{x},{y} L{x + w},{y} M{x},{y + h} L{x + w},{y + h}" class="stl"/>')
        s.append(f'<text x="{x + 15}" y="{y + h / 2 + 4}" text-anchor="middle" class="sid">{sid}</text>')
        if sub:
            s.append(f'<text x="{x + 40}" y="{y + 26}" class="nm{" mono" if mono else ""}">{esc(title)}</text>')
            s.append(f'<text x="{x + 40}" y="{y + 44}" class="sb">{esc(sub)}</text>')
        else:
            s.append(f'<text x="{x + 40}" y="{y + h / 2 + 4}" class="sb strong">{esc(title)}</text>')

    def ext(x, y, w, title, sub="", cls="", h=H):
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" class="x {cls}"/>')
        s.append(f'<text x="{x + 12}" y="{y + 25}" class="nm">{esc(title)}</text>')
        if sub:
            s.append(f'<text x="{x + 12}" y="{y + 43}" class="sb">{esc(sub)}</text>')

    def hz(x1, x2, y, text="", cls="", both=False):
        s.append(arrow(p, [(x1, y), (x2, y)], cls, both))
        if text:
            s.append(label((x1 + x2) / 2, y - 7, text, cls=cls))

    def vt(x, y1, y2, text="", cls="", both=False, side="r"):
        s.append(arrow(p, [(x, y1), (x, y2)], cls, both))
        if text:
            if side == "r":
                s.append(label(x + 8, (y1 + y2) / 2 + 4, text, "start", cls))
            else:
                s.append(label(x - 8, (y1 + y2) / 2 + 4, text, "end", cls))

    # row 1: market data and System 1
    y = R[0]
    ext(30, y, 160, "OANDA practice", "prices")
    proc(250, y, 190, "Ingest prices", "System 1, hourly", sysc="s1")
    store(500, y, 220, "D1", "ForexBrainDB", "prices, regimes, strategy ids")
    proc(790, y, 190, "Build and score signals", "System 1, hourly", sysc="s1")
    store(1030, y, 164, "D8", "Live strategy map", "files, rebuilt weekly", mono=False)
    hz(190, 250, y + 32, "candles"); hz(440, 500, y + 32, "writes"); hz(720, 790, y + 32, "reads"); hz(1030, 980, y + 32)

    # row 2: research
    y = R[1]
    ext(30, y, 160, "Public data sources", "macro, calendar")
    proc(250, y, 190, "Research jobs", "collect, backtest, forward test", "dev code, daily")
    store(500, y, 220, "D2", "scalable_brain_dev", "external data, research, ledger")
    proc(760, y, 190, "Research emitter", "production task, hourly")
    hz(190, 250, y + 32, "series"); hz(440, 500, y + 32, "writes"); hz(720, 760, y + 32, both=True)
    s.append(arrow(p, [(540, 100), (430, 150)])); s.append(label(484, 122, "prices", "end"))
    s.append(arrow(p, [(700, 150), (810, 100)], "warn")); s.append(label(722, 130, "macro factors", "end", "warn"))

    # queue bus
    store(200, 276, 810, "D3", "Queue: one SQLite file carries signals, orders, fills, account snapshots and commands", h=30)
    vt(968, 100, 276, "scored signals"); vt(855, 214, 276, "research signals")

    # row 3: trade path
    y = R[2]
    proc(250, y, 190, "Risk gate", "System 3 Guardian", "decides, sizes, journals", "s3")
    proc(480, y, 190, "Bridge", "translates Guardian and Hand", "polls broker for account state")
    proc(710, y, 190, "Execute orders", "System 2 Hand", sysc="s2")
    ext(1010, y, 184, "OANDA practice", "orders, fills (same account)")
    vt(345, 306, y, "signals in, orders out", both=True)
    vt(575, 306, y, "both directions", both=True)
    vt(805, 306, y, "orders in, fills out", both=True)
    hz(900, 1010, y + 20, "orders, closes"); hz(1010, 900, y + 46, "fills, prices")

    # row 4: stores under the trade path
    y = R[3]
    store(250, y, 190, "D4", "ams.db", "decisions, journal, positions")
    proc(500, y, 190, "Two trade copy jobs", "publisher, every 30 s", "journal sync, every 5 min")
    store(710, y, 190, "D5", "system2.db", "orders and fills, own copy")
    vt(345, R[2] + H, y, "reads, writes", both=True)
    vt(805, R[2] + H, y, "writes")
    hz(440, 500, y + 32, "reads")

    # row 5: dashboard
    y = R[4]
    ext(30, y, 120, "Owner", "browser")
    proc(200, y, 220, "Dashboard, control panel", "reads 3 databases, 4 SQLite files,", "JSON files and the broker")
    store(500, y, 190, "D6", "scalable_brain", "trades, signals, copy of D2")
    proc(750, y, 190, "Public export", "reads dashboard and databases", "every 5 min")
    ext(1010, y, 184, "Public status page", "GitHub")
    vt(595, R[3] + H, y, "upserts trades")
    hz(500, 420, y + 32, "reads"); hz(150, 200, y + 32, both=True)
    hz(690, 750, y + 32); hz(940, 1010, y + 32, "status")
    vt(345, y, R[3] + H, "edits controls", "warn")
    vt(225, y, 306, "inserts commands", "warn", side="l")

    # row 6: alerts
    y = R[5]
    store(30, y, 160, "D9", "State files", "heartbeats, latest only", mono=False)
    proc(250, y, 190, "Watchdog, bell relay", "every 5 min", "also reads the risk ledger")
    store(500, y, 190, "D7", "notifications.db", "the dashboard bell")
    hz(190, 250, y + 32, "reads"); hz(440, 500, y + 32, "posts")
    s.append(arrow(p, [(520, 726), (410, 670)])); s.append(label(480, 706, "bell", "start"))
    ext(250, 846, 190, "Telegram", "phone alerts", "bad", h=56)
    vt(345, y + H, 846, "0 of 290 delivered", "bad")

    for x, yy, n, c in ((720, 150, 1, "warn"), (1010, 291, 2, "warn"), (440, 486, 3, "warn"), (690, 486, 4, "warn"),
                        (225, 560, 5, "warn"), (1194, 36, 6, "warn"), (440, 846, 7, "bad"), (900, 486, 8, "warn"),
                        (190, 726, 9, "warn")):
        s.append(badge(x, yy, n, c))
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- figure 4: logical model (entities by owning store)
def logical():
    p = "l"
    W, H = 146, 44
    X = [36 + i * 166 for i in range(7)]
    s = [f'<svg viewBox="0 0 1224 650" role="img" aria-label="Logical model: entities grouped by owning store. '
         f'The config store holds brokers, accounts, instances, strategies, settings and snapshots. The trading store holds the trade path '
         f'from signal to decision, order, fill and trade, plus broker trades and equity samples. The finance store holds cash movements, '
         f'goals, projections and exchange rates. The ops store holds service status, heartbeats, alerts and operator commands. '
         f'Price bars, regimes, research and external data stay where they are. Every trading, finance and ops row carries an instance.">',
         defs(p)]

    def frame(x, y, w, h, title, sub="", mute=False):
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" class="fr{" mute" if mute else ""}"/>')
        s.append(f'<text x="{x + 16}" y="{y + 20}" class="fh{" mute" if mute else ""}">{esc(title)}</text>')
        if sub:
            s.append(f'<text x="{x + w - 16}" y="{y + 20}" text-anchor="end" class="fs">{esc(sub)}</text>')

    geo = {}

    def ent(key, x, y, w, name, eb, ver=False, spine=False):
        geo[key] = (x, y, w, H)
        s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{H}" rx="6" class="n{" spine" if spine else ""}"/>')
        s.append(f'<text x="{x + 12}" y="{y + 17}" class="eb">{esc(eb)}</text>')
        s.append(f'<text x="{x + 12}" y="{y + 35}" class="nm sm">{esc(name)}</text>')
        if ver:
            s.append(f'<circle cx="{x + w}" cy="{y}" r="8" class="vm"/>'
                     f'<text x="{x + w}" y="{y + 3.5}" text-anchor="middle" class="vt">v</text>')

    def cx(k):
        x, y, w, h = geo[k]
        return x + w / 2

    # --- config frame
    frame(20, 34, 1184, 214, "config", "reference data and versioned settings; the owner edits here")
    r1, r2 = 80, 188
    ent("chg", X[0], r1, W, "Change Log", "change_log")
    ent("snap", X[1], r1, W, "Snapshot", "snapshot")
    ent("modsel", X[2], r1, W, "Model Selection", "model_selection", ver=True)
    ent("cons", X[3], r1, W, "Instance Constraint", "instance_constraint", ver=True)
    ent("brk", X[4], r1, W, "Broker", "broker")
    ent("acct", X[5], r1, W, "Account", "account")
    ent("inst", X[6], r1, W, "Instance", "instance, state")
    ent("instr", X[0], r2, W, "Instrument", "instrument")
    ent("sver", X[1], r2, W, "Strategy Version", "strategy_version", ver=True)
    ent("strat", X[2], r2, W, "Strategy", "strategy, alias")
    ent("enab", X[3], r2, W, "Strategy Enablement", "strategy_enablement", ver=True)
    ent("sdef", X[4], r2, W, "Setting Definition", "setting_def")
    ent("sval", X[5], r2, W, "Setting Value", "setting_value", ver=True)
    # top bus: snapshot, model selection, constraint -> instance
    ty = 68
    for k in ("snap", "modsel", "cons"):
        s.append(arrow(p, [(cx(k), r1), (cx(k), ty)], head=False))
    s.append(arrow(p, [(cx("snap"), ty), (cx("inst"), ty), (cx("inst"), r1)]))
    # horizontal keys in row 1 and 2 (arrow = "refers to")
    s.append(arrow(p, [(X[5], r1 + 22), (X[4] + W, r1 + 22)]))
    s.append(arrow(p, [(X[6], r1 + 22), (X[5] + W, r1 + 22)]))
    s.append(arrow(p, [(X[1] + W, r2 + 22), (X[2], r2 + 22)]))
    s.append(arrow(p, [(X[3], r2 + 22), (X[2] + W, r2 + 22)]))
    s.append(arrow(p, [(X[5], r2 + 22), (X[4] + W, r2 + 22)]))
    # bottom bus: enablement, setting value -> instance
    by = 156
    for k in ("enab", "sval"):
        s.append(arrow(p, [(cx(k), r2), (cx(k), by)], head=False))
    s.append(arrow(p, [(cx("enab"), by), (cx("inst"), by), (cx("inst"), r1 + H)]))

    # --- trading frame
    TX = [36 + i * 156 for i in range(5)]
    TW = 112
    frame(20, 300, 770, 204, "trading", "the business ledger; one writer per table")
    ty1, ty2 = 346, 440
    spine = (("sig", "Signal", "signal"), ("dec", "Risk Decision", "decision"), ("ord", "Order", "order"),
             ("fil", "Fill", "fill"), ("trd", "Trade", "trade"))
    for i, (k, nme, tb) in enumerate(spine):
        x = TX[i]
        geo[k] = (x, ty1, TW, H)
        s.append(f'<rect x="{x}" y="{ty1}" width="{TW}" height="{H}" rx="6" class="n spine"/>')
        s.append(f'<text x="{x + 12}" y="{ty1 + 17}" class="eb">{tb}</text>')
        s.append(f'<text x="{x + 12}" y="{ty1 + 35}" class="nm sm">{esc(nme)}</text>')
    for i, t in enumerate(("1:1", "1:1", "1:n", "n:1")):
        x1, x2 = TX[i] + TW, TX[i + 1]
        s.append(arrow(p, [(x1, ty1 + 22), (x2, ty1 + 22)], "spine"))
        s.append(label((x1 + x2) / 2, ty1 + 17, t))
    ent("eq", TX[0], ty2, TW, "Equity Sample", "equity_sample")
    ent("bt", TX[4], ty2, TW, "Broker Trade", "broker_trade")
    s.append(arrow(p, [(cx("bt"), ty2), (cx("bt"), ty1 + H)], "off"))
    s.append(label(cx("bt") + 8, (ty2 + ty1 + H) / 2 + 4, "reconciled with", "start"))
    # signal -> strategy
    s.append(arrow(p, [(TX[0] + 84, ty1), (TX[0] + 84, 268), (cx("strat") - 20, 268), (cx("strat") - 20, r2 + H)]))
    s.append(label(TX[0] + 92, 289, "strategy, version, instrument", "start"))

    # --- instance carried by every fact
    bus = 280
    s.append(arrow(p, [(X[6] + W, 102), (1194, 102), (1194, 496), (1176, 496)], "off"))
    s.append(arrow(p, [(1194, bus), (610, bus), (610, 300)], "off"))
    s.append(arrow(p, [(1000, bus), (1000, 300)], "off", head=True))
    s.append(label(900, bus - 7, "every row below carries instance_id", cls="off"))

    # --- finance frame
    frame(806, 300, 370, 160, "finance", "reporting only")
    FW = 140
    fx1, fx2 = 822, 1020
    ent("goal", fx1, 340, FW, "Goal", "goal, goal_instance", ver=True)
    ent("proj", fx2, 340, FW, "Goal Projection", "goal_projection")
    ent("cash", fx1, 398, FW, "Cash Movement", "cash_movement")
    ent("fxr", fx2, 398, FW, "FX Rate", "fx_rate")
    s.append(arrow(p, [(fx2, 362), (fx1 + FW, 362)]))
    s.append(label((fx2 + fx1 + FW) / 2, 355, "n:1"))
    s.append(arrow(p, [(fx2 + FW / 2, 398), (fx2 + FW / 2, 384)]))

    # --- ops frame
    frame(806, 476, 370, 160, "ops", "monitoring and audit")
    ent("svc", fx1, 516, FW, "Service Status", "service_status")
    ent("hb", fx2, 516, FW, "Heartbeat", "heartbeat")
    ent("alr", fx1, 570, FW, "Alert", "alert, delivery")
    ent("cmd", fx2, 570, FW, "Operator Command", "operator_command")
    s.append(arrow(p, [(fx2, 538), (fx1 + FW, 538)]))
    s.append(label((fx2 + fx1 + FW) / 2, 531, "same service"))

    # --- stores that stay
    frame(20, 524, 770, 112, "stays as it is", "ForexBrainDB, research and ext are not changed", mute=True)
    ent("pb", 36, 568, TW + 20, "Price Bar", "ForexBrainDB")
    ent("rg", 36 + TW + 20 + 20, 568, TW + 20, "Regime", "ForexBrainDB")
    x3 = 36 + 2 * (TW + 40)
    geo["rs"] = (x3, 568, 770 - 16 - x3 + 20, H)
    s.append(f'<rect x="{x3}" y="568" width="{770 + 20 - 16 - x3}" height="{H}" rx="6" class="n"/>')
    s.append(f'<text x="{x3 + 12}" y="585" class="eb">research, ext</text>')
    s.append(f'<text x="{x3 + 12}" y="603" class="nm sm">Card, Backtest Run, Incubation, Forward Trade, External Data</text>')
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- figure 5: settings path
def settings_path():
    p = "s"
    s = [f'<svg viewBox="0 0 1224 262" role="img" aria-label="Settings path: the owner edits a setting; it is stored as a versioned '
         f'setting value; a resolve function picks the instance value, else the global value, else the default; the result is stored as a hashed '
         f'snapshot; a publisher writes one snapshot file per instance; the Guardian and Hand read the file. Below: what happens when the store is unavailable.">',
         defs(p)]
    boxes = [("1", "Owner edit", "dashboard or command line", "draft, validated, active"),
             ("2", "Versioned settings", "setting_def, setting_value", "global or per instance"),
             ("3", "Resolve", "config.resolve(): instance,", "else global, else default"),
             ("4", "Snapshot", "config.snapshot, one per", "instance, with a sha256 hash"),
             ("5", "Snapshot file", "settings_snapshot.json per", "instance, from the publisher"),
             ("6", "Guardian and Hand", "check the hash, switch at", "the next decision")]
    W, G, x0, y, H = 170, 24, 42, 30, 82
    for i, (n, t, a, b) in enumerate(boxes):
        x = x0 + i * (W + G)
        s.append(f'<rect x="{x}" y="{y}" width="{W}" height="{H}" rx="10" class="pr"/>')
        s.append(f'<text x="{x + 14}" y="{y + 24}" class="nm">{esc(t)}</text>')
        s.append(f'<text x="{x + 14}" y="{y + 46}" class="sb">{esc(a)}</text>')
        s.append(f'<text x="{x + 14}" y="{y + 62}" class="sb">{esc(b)}</text>')
        if i:
            s.append(arrow(p, [(x - G, y + H / 2), (x, y + H / 2)]))
    s.append('<rect x="42" y="146" width="1140" height="94" rx="8" class="x off"/>')
    s.append('<text x="58" y="170" class="nm">If the store is unavailable</text>')
    lines = ["PostgreSQL down: the publisher does nothing and raises an alert after 5 minutes. Services keep running on the last-known-good file.",
             "File missing or hash wrong: a practice instance refuses to start; a running one keeps its copy in memory and alerts.",
             "A live instance stops admitting new entries 24 hours after the last publish. Open trades are never closed by a settings fault."]
    for i, t in enumerate(lines):
        s.append(f'<text x="58" y="{192 + i * 17}" class="sb strong">{esc(t)}</text>')
    s.append("</svg>")
    return "".join(s)


# ---------------------------------------------------------------- physical model: table boxes
LH = 14


def tbox_h(cols, more):
    return 26 + len(cols) * LH + (LH if more else 0) + 6


def tbox(s, x, y, w, name, spec, spine=False):
    cols, more, tag, ver = spec
    h = tbox_h(cols, more)
    s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" class="tb{" spine" if spine else ""}"/>')
    s.append(f'<path d="M{x + 0.5},{y + 24} V{y + 4.5} Q{x + 0.5},{y + 0.5} {x + 4.5},{y + 0.5} H{x + w - 4.5} '
             f'Q{x + w - 0.5},{y + 0.5} {x + w - 0.5},{y + 4.5} V{y + 24} Z" class="tbh"/>')
    s.append(f'<text x="{x + 10}" y="{y + 16}" class="nm mono">{esc(name)}</text>')
    if ver:
        s.append(f'<circle cx="{x + w}" cy="{y}" r="8" class="vm"/><text x="{x + w}" y="{y + 3.5}" text-anchor="middle" class="vt">v</text>')
    elif tag:
        s.append(f'<text x="{x + w - 8}" y="{y + 16}" text-anchor="end" class="tg">{esc(tag)}</text>')
    for i, (mk, nm, note) in enumerate(cols):
        yy = y + 39 + i * LH
        if mk:
            s.append(f'<text x="{x + 8}" y="{yy}" class="mk {mk.lower()}">{mk}</text>')
        t = f'<text x="{x + 30}" y="{yy}" class="cl">{esc(nm)}'
        if note:
            t += f'<tspan dx="5" class="cn">{esc(note)}</tspan>'
        s.append(t + "</text>")
    if more:
        s.append(f'<text x="{x + 30}" y="{y + 39 + len(cols) * LH}" class="cn">+{more} more</text>')
    return {"x": x, "y": y, "w": w, "h": h, "cx": x + w / 2, "b": y + h, "r": x + w}


def trow(s, data, y, W, X, items, spine=False):
    out, bot = {}, 0
    for c, name in items:
        g = tbox(s, X[c], y, W, name, data[name], spine)
        out[name] = g
        bot = max(bot, g["b"])
    return out, bot


def ext_box(s, x, y, w, name, h=34):
    s.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" class="x"/>')
    s.append(f'<text x="{x + w / 2}" y="{y + 14}" text-anchor="middle" class="eb">config</text>')
    s.append(f'<text x="{x + w / 2}" y="{y + 28}" text-anchor="middle" class="nm mono">{esc(name)}</text>')


PK, FK, UQ = "PK", "FK", "UQ"
CT = {
    "broker": ([(PK, "broker_key", ""), ("", "kind", ""), ("", "api_family", ""), ("", "practice_host", ""), ("", "live_host", "")], 2, "", False),
    "account": ([(PK, "account_key", ""), (FK, "broker_key", ""), ("", "account_kind", ""), ("", "external_id_suffix", ""), ("", "currency", "")], 2, "", False),
    "instance": ([(PK, "instance_id", ""), (UQ, "instance_key", ""), (FK, "account_key", ""), ("", "runtime_env", ""), ("", "instance_type", ""), ("", "status", "")], 10, "", False),
    "instance_state": ([(PK, "instance_id", "FK"), ("", "gate_state", ""), ("", "halted_until", ""), ("", "breaker_latched", ""), ("", "settings_version", "")], 2, "", False),
    "snapshot": ([(PK, "instance_id", "FK"), (PK, "snapshot_version", ""), ("", "resolved", "jsonb"), ("", "hash", ""), ("", "published_at", "")], 2, "", False),
    "model_selection": ([(PK, "selection_id", ""), ("", "scope", ""), (FK, "instance_id", ""), ("", "version", ""), ("", "model_set_id", ""), ("", "status", "")], 10, "", True),
    "instance_constraint": ([(PK, "constraint_id", ""), (PK, "version", ""), (FK, "instance_id", ""), ("", "rule_type", ""), ("", "params", "jsonb"), ("", "hard", "")], 11, "", True),
    "constraint_schema": ([(PK, "rule_type", ""), ("", "json_schema", "jsonb"), ("", "description", "")], 0, "", False),
    "change_log": ([(PK, "change_id", ""), ("", "at", ""), ("", "table_name", ""), ("", "row_key", "jsonb"), ("", "to_status", ""), ("", "reason", "")], 6, "append-only", False),
    "setting_value": ([(PK, "value_id", ""), (FK, "setting_key", ""), ("", "scope", ""), (FK, "instance_id", ""), ("", "version", ""), ("", "value", "jsonb")], 9, "", True),
    "setting_def": ([(PK, "setting_key", ""), ("", "value_type", ""), ("", "scope_allowed", ""), ("", "consumer", ""), ("", "sensitivity", ""), ("", "default_value", "")], 3, "", False),
    "strategy_enablement": ([(PK, "enablement_id", ""), (FK, "strategy_key", ""), (FK, "instance_id", ""), ("", "enabled", ""), ("", "allocation_multiplier", ""), ("", "control_status", "")], 16, "", True),
    "strategy": ([(PK, "strategy_key", ""), (UQ, "s1_strategy_id", ""), ("", "producer", ""), ("", "lifecycle_stage", ""), ("", "granularity", ""), ("", "is_active", "")], 6, "", False),
    "strategy_version": ([(PK, "strategy_key", "FK"), (PK, "version", ""), ("", "code_sha", ""), ("", "params", "jsonb"), ("", "effective_from", "")], 5, "", True),
    "strategy_alias": ([(PK, "alias", ""), ("", "alias_kind", ""), (FK, "strategy_key", "")], 0, "", False),
    "instrument": ([(PK, "symbol", ""), ("", "asset_class", ""), ("", "pip_location", ""), ("", "minimum_trade_size", ""), ("", "is_active", ""), ("", "synced_at", "")], 6, "", False),
    "instance_instrument": ([(PK, "instance_id", "FK"), (PK, "symbol", "FK"), ("", "tradeable", ""), ("", "margin_rate", ""), ("", "max_spread", ""), ("", "synced_at", "")], 2, "", False),
}

TT = {
    "signal": ([(PK, "signal_id", "uuid"), (UQ, "signal_group_id", "+ instance"), (FK, "instance_id", ""), (FK, "strategy_key", ""), (FK, "symbol", ""), ("", "strategy_version", "")], 22, "insert-only", False),
    "decision": ([(PK, "signal_id", "FK"), (FK, "instance_id", ""), ("", "outcome", ""), ("", "rejected_at_layer", ""), ("", "settings_version", ""), ("", "decided_at", "")], 9, "insert-only", False),
    "order": ([(PK, "order_request_id", ""), (FK, "instance_id", ""), (FK, "signal_id", ""), ("", "executor_status", ""), ("", "execution_mode", ""), ("", "approved_at", "")], 12, "result update", False),
    "fill": ([(PK, "instance_id", "FK"), (PK, "broker_txn_id", ""), (FK, "order_request_id", ""), ("", "kind", ""), ("", "fill_price", ""), ("", "net_pnl", "")], 14, "insert-only", False),
    "trade": ([(PK, "instance_id", "FK"), (PK, "broker_order_id", ""), (FK, "order_request_id", ""), (FK, "signal_id", ""), (FK, "strategy_key", ""), ("", "status", "")], 22, "close update", False),
    "equity_sample": ([(PK, "instance_id", "FK"), (PK, "at", ""), ("", "balance", ""), ("", "equity", ""), ("", "open_positions", ""), ("", "source", "")], 3, "insert-only", False),
    "instance_day": ([(PK, "instance_id", "FK"), (PK, "day_start", ""), ("", "day_start_balance", ""), ("", "day_end", ""), ("", "realized_pnl", ""), ("", "trades", "")], 3, "day-end update", False),
    "broker_trade": ([(PK, "instance_id", "FK"), (PK, "broker_trade_id", ""), ("", "client_order_id", ""), ("", "symbol", ""), ("", "state", ""), ("", "seen_at", "")], 8, "close update", False),
}

FT = {
    "cash_movement": ([(PK, "movement_id", ""), (FK, "instance_id", ""), ("", "at", ""), ("", "kind", ""), ("", "amount", ""), (UQ, "broker_txn_id", "+ instance")], 6, "append-only", False),
    "goal_instance": ([(PK, "goal_id", "FK"), (PK, "instance_id", "FK"), ("", "counts_as", "")], 0, "", False),
    "goal": ([(PK, "goal_id", ""), (UQ, "year", "+ version"), ("", "target_amount", ""), ("", "goal_currency", ""), ("", "method", ""), ("", "status", "")], 17, "", True),
    "goal_milestone": ([(PK, "goal_id", "FK"), (PK, "milestone_date", ""), ("", "label", ""), ("", "target_amount", "")], 0, "", False),
    "goal_projection": ([(PK, "goal_id", "FK"), (PK, "as_of", ""), ("", "realized_profit", ""), ("", "equity_total", ""), ("", "forecast_p50", ""), ("", "odds_of_target", "")], 10, "", False),
    "fx_rate": ([(PK, "rate_date", ""), (PK, "from_ccy", ""), (PK, "to_ccy", ""), ("", "rate", ""), ("", "source", "")], 0, "", False),
}

OT = {
    "service_status": ([(PK, "status_id", ""), (UQ, "service_key", "+ instance"), (FK, "instance_id", ""), ("", "state", ""), ("", "last_heartbeat_at", ""), ("", "as_of", "")], 6, "", False),
    "heartbeat": ([(PK, "heartbeat_id", ""), (UQ, "service_key", "+ instance, at"), (FK, "instance_id", ""), ("", "at", ""), ("", "alive", ""), ("", "latency_ms", "")], 0, "", False),
    "alert": ([(PK, "alert_id", ""), (FK, "instance_id", ""), ("", "severity", ""), ("", "source", ""), ("", "kind", ""), (UQ, "dedup_key", "")], 7, "", False),
    "alert_delivery": ([(PK, "alert_id", "FK"), (PK, "channel", ""), (PK, "attempted_at", ""), ("", "delivered", ""), ("", "error", "")], 0, "", False),
    "operator_command": ([(PK, "command_id", ""), ("", "at", ""), (FK, "instance_id", ""), ("", "command", ""), ("", "result", ""), ("", "surface", "")], 4, "", False),
    "source_registry": ([(PK, "source_key", ""), ("", "kind", ""), ("", "loader", ""), ("", "cadence_sec", ""), ("", "age_query", ""), ("", "stale_after_sec", "")], 1, "", False),
}


def phys_config():
    p = "q"
    W, G = 176, 26
    X = [19 + i * (W + G) for i in range(6)]
    s = []
    r0, b0 = trow(s, CT, 14, W, X, [(0, "change_log"), (1, "instance_state"), (2, "snapshot"), (3, "model_selection"),
                                    (4, "instance_constraint"), (5, "constraint_schema")])
    y1 = b0 + 56
    r1, b1 = trow(s, CT, y1, W, X, [(0, "broker"), (1, "account"), (2, "instance"), (3, "setting_value"), (4, "setting_def")])
    y2 = b1 + 56
    r2, b2 = trow(s, CT, y2, W, X, [(0, "instrument"), (1, "instance_instrument"), (2, "strategy_enablement"), (3, "strategy"),
                                    (4, "strategy_version"), (5, "strategy_alias")])
    g = {**r0, **r1, **r2}
    e = []
    bus = b0 + 28
    for n in ("instance_state", "model_selection", "instance_constraint"):
        e.append(arrow(p, [(g[n]["cx"], g[n]["b"]), (g[n]["cx"], bus)], head=False))
    e.append(arrow(p, [(g["instance_state"]["cx"], bus), (g["instance_constraint"]["cx"], bus)], head=False))
    e.append(arrow(p, [(g["snapshot"]["cx"], g["snapshot"]["b"]), (g["instance"]["cx"], g["instance"]["y"])]))
    ya = y1 + 12
    e.append(arrow(p, [(g["account"]["x"], ya), (g["broker"]["r"], ya)]))
    e.append(arrow(p, [(g["instance"]["x"], ya), (g["account"]["r"], ya)]))
    e.append(arrow(p, [(g["setting_value"]["x"], ya), (g["instance"]["r"], ya)]))
    e.append(arrow(p, [(g["setting_value"]["r"], ya), (g["setting_def"]["x"], ya)]))
    bus2 = b1 + 28
    e.append(arrow(p, [(g["instance_instrument"]["cx"], y2), (g["instance_instrument"]["cx"], bus2)], head=False))
    e.append(arrow(p, [(g["instance_instrument"]["cx"], bus2), (g["instance"]["cx"], bus2)], head=False))
    e.append(arrow(p, [(g["strategy_enablement"]["cx"], y2), (g["instance"]["cx"], g["instance"]["b"])]))
    yb = y2 + 12
    e.append(arrow(p, [(g["instance_instrument"]["x"], yb), (g["instrument"]["r"], yb)]))
    e.append(arrow(p, [(g["strategy_enablement"]["r"], yb), (g["strategy"]["x"], yb)]))
    e.append(arrow(p, [(g["strategy_version"]["x"], yb), (g["strategy"]["r"], yb)]))
    ya2 = b2 + 22
    e.append(arrow(p, [(g["strategy_alias"]["cx"], g["strategy_alias"]["b"]), (g["strategy_alias"]["cx"], ya2),
                       (g["strategy"]["cx"], ya2), (g["strategy"]["cx"], g["strategy"]["b"])]))
    H = ya2 + 16
    head = (f'<svg viewBox="0 0 1224 {H}" role="img" aria-label="Schema config as built: 17 tables. Instance is the hub: snapshots, model '
            f'selections, constraints, instance state, settings, enablements and instrument links all refer to it. Strategy has versions, aliases '
            f'and enablements. Settings have a definition and versioned values. Broker, account and instance form a chain.">' + defs(p))
    return head + "".join(e) + "".join(s) + "</svg>"


def phys_trading():
    p = "t"
    W, G = 214, 28
    X = [21 + i * (W + G) for i in range(5)]
    s = []
    for x, w, n in ((21, 104, "strategy"), (131, 104, "instrument")):
        ext_box(s, x, 14, w, n)
    ext_box(s, X[1], 14, 1203 - X[1], "instance")
    yA = 102
    rA, bA = trow(s, TT, yA, W, X, [(0, "signal"), (1, "decision"), (2, "order"), (3, "fill"), (4, "trade")], spine=True)
    e = []
    e.append(arrow(p, [(73, yA), (73, 48)]))
    e.append(arrow(p, [(183, yA), (183, 48)]))
    for n in ("decision", "order", "fill", "trade"):
        e.append(arrow(p, [(rA[n]["cx"], yA), (rA[n]["cx"], 48)]))
    ya = yA + 12
    e.append(arrow(p, [(rA["decision"]["x"], ya), (rA["signal"]["r"], ya)]))
    e.append(arrow(p, [(rA["fill"]["x"], ya), (rA["order"]["r"], ya)]))
    xs1, xs2 = rA["signal"]["x"] + 150, rA["signal"]["x"] + 60
    xo1, xo2 = rA["order"]["x"] + 40, rA["order"]["x"] + 170
    xt1, xt2 = rA["trade"]["x"] + 60, rA["trade"]["x"] + 150
    e.append(arrow(p, [(xo1, rA["order"]["b"]), (xo1, bA + 14), (xs1, bA + 14), (xs1, rA["signal"]["b"])]))
    e.append(arrow(p, [(xt1, rA["trade"]["b"]), (xt1, bA + 28), (xo2, bA + 28), (xo2, rA["order"]["b"])]))
    e.append(arrow(p, [(xt2, rA["trade"]["b"]), (xt2, bA + 42), (xs2, bA + 42), (xs2, rA["signal"]["b"])]))
    yB = bA + 64
    rB, bB = trow(s, TT, yB, W, X, [(0, "equity_sample"), (1, "instance_day"), (4, "broker_trade")])
    s.append(f'<text x="{X[2]}" y="{yB + 14}" class="sb">Views: v_reconciliation compares trade with broker_trade;</text>')
    s.append(f'<text x="{X[2]}" y="{yB + 30}" class="sb">v_stuck_orders lists approved orders with no executor result.</text>')
    s.append(f'<text x="{X[2]}" y="{yB + 52}" class="sb">Every table here also has instance_id, a key to config.instance.</text>')
    H = bB + 16
    head = (f'<svg viewBox="0 0 1224 {H}" role="img" aria-label="Schema trading as built: 8 tables. Signal, decision, order, fill and trade form '
            f'the trade path in a row; decision and order refer to the signal, fill refers to the order, trade refers to the order and the signal. '
            f'Broker trade, equity sample and instance day sit below. All refer to config instance; signal also refers to strategy and instrument.">'
            + defs(p))
    return head + "".join(e) + "".join(s) + "</svg>"


def phys_finance():
    p = "n"
    W, G = 262, 44
    X = [22 + i * (W + G) for i in range(4)]
    s = []
    ext_box(s, 22, 14, X[1] + W - 22, "instance")
    yA = 100
    rA, bA = trow(s, FT, yA, W, X, [(0, "cash_movement"), (1, "goal_instance"), (2, "goal"), (3, "goal_milestone")])
    e = [arrow(p, [(rA["cash_movement"]["cx"], yA), (rA["cash_movement"]["cx"], 48)]),
         arrow(p, [(rA["goal_instance"]["cx"], yA), (rA["goal_instance"]["cx"], 48)])]
    ya = yA + 12
    e.append(arrow(p, [(rA["goal_instance"]["r"], ya), (rA["goal"]["x"], ya)]))
    e.append(arrow(p, [(rA["goal_milestone"]["x"], ya), (rA["goal"]["r"], ya)]))
    yB = bA + 50
    rB, bB = trow(s, FT, yB, W, X, [(2, "goal_projection"), (3, "fx_rate")])
    e.append(arrow(p, [(rB["goal_projection"]["cx"], yB), (rA["goal"]["cx"], rA["goal"]["b"])]))
    s.append(f'<text x="{X[0]}" y="{yB + 14}" class="sb">View: v_instance_ledger gives, per day and instance, trading profit,</text>')
    s.append(f'<text x="{X[0]}" y="{yB + 30}" class="sb">financing, fees, cash moves and equity.</text>')
    s.append(f'<text x="{X[0]}" y="{yB + 52}" class="sb">fx_rate has no key to the goal; the projection job reads it by date.</text>')
    H = bB + 16
    head = (f'<svg viewBox="0 0 1224 {H}" role="img" aria-label="Schema finance as built: 6 tables. Goal has instances, milestones and projections. '
            f'Cash movement and goal instance refer to config instance. Fx rate stands alone.">' + defs(p))
    return head + "".join(e) + "".join(s) + "</svg>"


def phys_ops():
    p = "o"
    W, G = 262, 44
    X = [22 + i * (W + G) for i in range(4)]
    s = []
    ext_box(s, 22, 14, 1180, "instance")
    yA = 100
    rA, bA = trow(s, OT, yA, W, X, [(0, "service_status"), (1, "heartbeat"), (2, "alert"), (3, "operator_command")])
    e = [arrow(p, [(rA[n]["cx"], yA), (rA[n]["cx"], 48)]) for n in rA]
    yB = bA + 50
    rB, bB = trow(s, OT, yB, W, X, [(0, "source_registry"), (2, "alert_delivery")])
    e.append(arrow(p, [(rB["alert_delivery"]["cx"], yB), (rA["alert"]["cx"], rA["alert"]["b"])]))
    s.append(f'<text x="{X[1]}" y="{yB + 14}" class="sb">View: v_source_freshness runs each age_query.</text>')
    s.append(f'<text x="{X[1]}" y="{yB + 30}" class="sb">service_status and heartbeat share</text>')
    s.append(f'<text x="{X[1]}" y="{yB + 46}" class="sb">service_key but have no key between them.</text>')
    H = bB + 16
    head = (f'<svg viewBox="0 0 1224 {H}" role="img" aria-label="Schema ops as built: 6 tables. Service status, heartbeat, alert and operator command '
            f'refer to config instance. Alert delivery refers to alert. Source registry stands alone.">' + defs(p))
    return head + "".join(e) + "".join(s) + "</svg>"


# ---------------------------------------------------------------- logical and physical content
LOGICAL_ROWS = [
    ("Broker", "config", "broker", "Owner, in dashboard settings", "None"),
    ("Account", "config", "account", "Owner, in dashboard settings", "The account id column in ams.db becomes a reference"),
    ("Instance", "config", "instance, instance_state", "Owner (rows); ledger relay (state)", "The live schema; the X-SB-Account header"),
    ("Instance Constraint", "config", "instance_constraint, constraint_schema", "Owner, in dashboard settings", "None"),
    ("Strategy", "config", "strategy, strategy_alias", "Card sync and owner", "Catalogue files as a key source; other strategy tables become declared copies"),
    ("Strategy Version", "config", "strategy_version", "Brain publish step; research card sync", "A backup file used as a version"),
    ("Strategy Enablement", "config", "strategy_enablement", "Owner; allocation review proposes drafts", "Live book files, designations list, strategy controls and allocation tables"),
    ("Setting", "config", "setting_def, setting_value, change_log, snapshot", "Owner; the config publisher writes snapshots", "Risk config files, execution limits in the env file, deferral lists"),
    ("Instrument", "config", "instrument, instance_instrument", "Instrument sync from the broker", "Pair lists repeated in code"),
    ("Signal", "trading", "signal", "Brain ingester and research emitter, through one library", "Signal log table; research intent table (folded in)"),
    ("Risk Decision", "trading", "decision", "Ledger relay, from the Guardian journal", "Daily history JSON files"),
    ("Order", "trading", "order", "Ledger relay, from Hand's record", "None; the order watch table stays Guardian-private"),
    ("Fill", "trading", "fill", "Ledger relay; the broker is the outside truth", "None"),
    ("Trade", "trading", "trade, broker_trade", "Ledger relay (trade); account relay (broker_trade)", "Four trade tables and history files in the old stores"),
    ("Equity Sample", "trading", "equity_sample", "Account relay, once a minute per instance", "Equity history database and JSON files"),
    ("Cash Movement", "finance", "cash_movement", "Account relay (broker transfers); owner (manual kinds)", "None"),
    ("Goal, Projection", "finance", "goal, goal_instance, goal_milestone, goal_projection, fx_rate", "Owner; daily projection job", "Monte Carlo inputs typed into the Performance view"),
    ("Price Bar, Regime", "ForexBrainDB", "unchanged", "System 1", "The nine-row regime copy in the dashboard database"),
    ("External Data", "ext", "unchanged", "Research collectors", "Nightly mirror"),
    ("Card, Backtest Run, Incubation, Forward Trade", "research", "unchanged", "Research jobs", "Old SQLite incubator"),
    ("Service, Heartbeat", "ops", "service_status, heartbeat", "Watchdog relay", "Dead telemetry copies"),
    ("Alert", "ops", "alert, alert_delivery", "The bell library; every producer posts through it", "Notifications database; the Guardian outbox becomes private"),
    ("Operator Command", "ops", "operator_command", "Control-panel relay, dashboard endpoints, Guardian audit relay", "None; panel and override audit stay as producer copies"),
]

INVARIANTS = [
    "Wire contracts (signal, order, fill, account snapshot, command) change only with the code that reads them.",
    "The order and meaning of the Guardian's gate layers is code. Every threshold inside it is a setting.",
    "Sizing arithmetic and rounding are code. Risk percentages and multipliers are settings.",
    "Broker binding: host, account kind and account id must agree, with exactly one credential set. A live instance will not boot without the owner's mode file.",
    "Order idempotency: a client id, reconcile before create, and an order that cannot be verified counts as already sent.",
    "The STOP sentinel is absolute. Breakers latch until an operator resets them.",
    "No default instance: a message or row with no instance key is refused.",
    "The trade path cannot read the finance schema, so a goal can never loosen risk.",
    "Ledgers are append-only by trigger. Settings-unavailable behaviour and the snapshot hash check are code, not settings.",
]

PHYS_ROWS = [
    ("config", "broker", "One broker or prop firm", "broker_key", "None", "1 row (OANDA)"),
    ("config", "account", "One broker account; only the last 4 characters of the id are kept", "account_key", "Key to broker", "2 rows; the live suffix is a placeholder (TBD0)"),
    ("config", "instance", "One trading context", "instance_id", "Unique instance_key and port_base; unique (account_key, runtime_env); instance_id above 0. Execution mode is a setting, not a column", "3 rows"),
    ("config", "instance_state", "Latest Guardian state of one instance", "instance_id", "Key to instance", "Empty until the ledger relay runs"),
    ("config", "strategy", "Strategy master, one row per strategy", "strategy_key", "Unique s1_strategy_id", "11 minimal rows"),
    ("config", "strategy_alias", "Another name a strategy is known by", "alias", "Key to strategy", "16 rows"),
    ("config", "strategy_version", "One code and parameter version of a strategy", "(strategy_key, version)", "Unique (strategy_key, code_sha, params)", "Empty"),
    ("config", "instrument", "A tradable instrument, synced from the broker", "symbol", "None", "Empty until the instrument sync runs"),
    ("config", "instance_instrument", "Which instruments an instance may trade, with the margin rate", "(instance_id, symbol)", "Keys to instance and instrument", "Empty"),
    ("config", "setting_def", "One configurable key with its type, scope and validation schema", "setting_key", "None", "177 keys from 027, plus feature flags from 028 and 029"),
    ("config", "setting_value", "One version of one setting at one scope", "value_id", "Unique (key, scope, instance, version); one active row per key and scope; scope and instance must agree; trigger lets only status and validity columns change", "Seeded; Wave 2 flags are off"),
    ("config", "strategy_enablement", "One version of one strategy's enablement at one scope", "enablement_id", "Same version rules as setting_value; allocation_multiplier in (0, 1]; control_status ACTIVE, PAUSED or DRAINING", "9 rows from 027; 028 adds control fields"),
    ("config", "model_selection", "One version of the model choice at one scope", "selection_id", "Unique (scope, instance, version); same update trigger", "Empty"),
    ("config", "instance_constraint", "One version of one hard rule on one instance", "(constraint_id, version)", "rule_type is one of 8 types; same update trigger", "Empty"),
    ("config", "constraint_schema", "The parameter schema of each rule type", "rule_type", "None", "8 rows"),
    ("config", "change_log", "One transition of any versioned config row", "change_id", "Append-only trigger: update and delete are refused", "Written by migrations and activations"),
    ("config", "snapshot", "One published, hashed settings set for one instance", "(instance_id, snapshot_version)", "Key to instance", "Empty until the config publisher runs"),
    ("trading", "signal", "One signal for one instance", "signal_id", "Unique (signal_group_id, instance_id); insert-only trigger; truncate refused", "Empty; the signal writer flag is off"),
    ("trading", "decision", "The Guardian's verdict on one signal", "signal_id", "Key to signal; insert-only trigger", "Empty until the ledger relay runs"),
    ("trading", "order", "One approved order and its executor result", "order_request_id", "Only executor_status and result fields may change; delete refused", "Empty until the ledger relay runs"),
    ("trading", "fill", "One broker fill transaction", "(instance_id, broker_txn_id)", "Insert-only trigger", "Empty until the ledger relay runs"),
    ("trading", "trade", "One trade from open to close", "(instance_id, broker_order_id)", "Only close columns may change, and only by the relay; delete refused", "Empty until the ledger relay runs"),
    ("trading", "broker_trade", "A trade as the broker reports it", "(instance_id, broker_trade_id)", "Only close-out columns may change (migration 028); delete refused", "Empty until the account relay runs"),
    ("trading", "equity_sample", "Balance and equity of one instance per minute", "(instance_id, at)", "Insert-only trigger", "Empty until the account relay runs"),
    ("trading", "instance_day", "One trading day of one instance, for daily-loss rules", "(instance_id, day_start)", "Only day-end columns may change (migration 028); delete refused", "Empty until the ledger relay runs"),
    ("finance", "cash_movement", "Money in or out of one instance", "movement_id", "Unique (instance_id, broker_txn_id); update, delete and truncate refused", "Empty until the account relay runs"),
    ("finance", "goal", "One version of the yearly goal", "goal_id", "Unique (year, version); no update trigger yet", "Empty; no goal chosen"),
    ("finance", "goal_instance", "Which instances count toward a goal, and how", "(goal_id, instance_id)", "counts_as is trading_pnl or net_payouts", "Empty"),
    ("finance", "goal_milestone", "An intermediate target of a goal", "(goal_id, milestone_date)", "Key to goal", "Empty"),
    ("finance", "fx_rate", "Daily conversion rate between two currencies", "(rate_date, from_ccy, to_ccy)", "None; a missing rate stops a projection, it is never guessed", "Empty"),
    ("finance", "goal_projection", "One daily projection run for one goal", "(goal_id, as_of)", "Key to goal", "Empty until the projection job runs"),
    ("ops", "service_status", "Latest status of one service (per instance)", "status_id", "Unique (service_key, instance); the relay upserts on it", "Empty until the watchdog relay runs"),
    ("ops", "heartbeat", "Sampled heartbeat history, one row per service per minute", "heartbeat_id", "Unique (service_key, instance, at); 90-day clean-up planned", "Empty until the watchdog relay runs"),
    ("ops", "alert", "One alert; the dashboard bell reads it", "alert_id", "Unique dedup_key; severity is info, warning or critical", "Empty until the bell library writes it"),
    ("ops", "alert_delivery", "One delivery attempt of one alert on one channel", "(alert_id, channel, attempted_at)", "Key to alert", "Empty"),
    ("ops", "operator_command", "One operator command, from any surface", "command_id", "None", "Empty until the relays run"),
    ("ops", "source_registry", "Every store the dashboard reads, with how its age is measured", "source_key", "None", "14 rows"),
]

SQLITE_ROWS = [
    ("ams.db", "Guardian journal. Gains instance_key on every table, settings_version and constraints_checked on decisions, and a new instance-day table. The two strategy control tables are retired as sources."),
    ("system2.db", "Hand's order record. Gains instance_key, execution_mode and settings_version; the relay becomes its first reader."),
    ("queue.db", "The message queue. One file per instance; a service refuses a queue that belongs to another instance. It is transport only."),
    ("fill_outbox.db, processed.db, close_sweep.db", "Move into each instance's own folder. Schema unchanged."),
    ("equity_history.db, notifications.db, shadow_incubator.db", "Retired after their data is copied into PostgreSQL."),
]


def _rows(rows, cls):
    out = []
    for r in rows:
        out.append("<tr>" + "".join(f'<td class="{c}">{esc(v)}</td>' if c else f"<td>{esc(v)}</td>" for c, v in zip(cls, r)) + "</tr>")
    return "".join(out)


def logical_section():
    ent = _rows(LOGICAL_ROWS, ("entw", "dom", "", "", "now"))
    inv = "".join(f"<li>{esc(t)}</li>" for t in INVARIANTS)
    return f"""
<section>
  <h2>Logical model</h2>
  <p>The conceptual things now have one owning store each, with keys and history rules. Four new schemas in the existing PostgreSQL database hold them: <strong>config</strong>, <strong>trading</strong>, <strong>finance</strong> and <strong>ops</strong>. Price bars, regimes, research and external data stay where they are. Rows are keyed by business keys, every time is a UTC instant, and every trading, finance and ops row names its instance.</p>
  <div class="key">
    <span><i class="kp"></i>Entity, with the table name above it</span><span><b class="kv">v</b>Versioned: new rows, never edits</span>
    <span><i class="kx"></i>Heavy outline: the trade path</span><span><i class="kw"></i>Carried by every row</span>
  </div>
  <figure>
    <div class="scroll">{logical()}</div>
    <figcaption>Entities grouped by the store that owns them. A plain arrow means "refers to": it points from the entity that holds the key to the entity it names, many to one. The heavy row is the trade path, with the ratio between neighbours. Every scoped config row (setting value, enablement, model selection, constraint, snapshot) points to Instance; two shared lines draw that. Entities marked v are versioned: a change adds a row with its own dates and status, and the old row is kept. The trade path (Brain, Guardian, Hand, bridge) never reads the trading, finance or ops schemas; it reads only its own journal and the settings snapshot file.</figcaption>
  </figure>
  <div class="tscroll"><table>
    <thead><tr><th>Entity</th><th>Owning store</th><th>Table(s)</th><th>Writer</th><th>Retired copies</th></tr></thead>
    <tbody>{ent}</tbody>
  </table></div>
  <p>For risk decisions, orders and trades, the producer's own journal stays as the working copy. The business record is the PostgreSQL table, and one relay is its only writer. If they disagree, the journal is corrected through an audited command and the relay re-syncs.</p>
  <h3>How a setting reaches the trade path</h3>
  <figure>
    <div class="scroll">{settings_path()}</div>
    <figcaption>A setting is a definition plus versioned values. Resolution takes the instance value, else the global value, else the default. A key with no default and no value is an error and no snapshot is published. Keys marked as risk need a second, separate confirmation, and a dry run of the gate over the last 200 decisions is attached before activation.</figcaption>
  </figure>
  <h3>What stays in code</h3>
  <ul class="inv">{inv}</ul>
</section>
"""


def physical_section():
    rows = _rows(PHYS_ROWS, ("dom", "ent", "", "now", "", "now"))
    sq = "".join(f'<li><strong>{esc(a)}</strong>: {esc(b)}</li>' for a, b in SQLITE_ROWS)
    return f"""
<section>
  <h2>Physical model, as built in production</h2>
  <p>On 16 November 2026 migrations 020 and 022 to 029 were applied to the production database <strong>scalable_brain</strong>. They created the four schemas, 37 tables, four views and the functions that validate, activate and resolve settings, then seeded the reference rows and the settings. <strong>The trade path does not read any of this yet.</strong> The feature flags that switch it on are all off, so production behaves as it did before.</p>
  <div class="key">
    <span><b class="kpk">PK</b>Primary key</span><span><b class="kfk">FK</b>Key to another table</span><span><b class="kuq">UQ</b>Unique</span>
    <span><b class="kv">v</b>Versioned rows</span><span><i class="kx"></i>Table in another schema</span>
  </div>
  <h3>Schema config</h3>
  <figure>
    <div class="scroll">{phys_config()}</div>
    <figcaption>17 tables. Each box shows its key columns and up to six others; "+n more" counts the rest. Arrows run from the table that holds a key to the table it refers to. The lines into Instance from above and below are shared lines, each fed by the tables joined to them. Apart from the seeded rows listed in the table below, these tables are empty.</figcaption>
  </figure>
  <h3>Schema trading</h3>
  <figure>
    <div class="scroll">{phys_trading()}</div>
    <figcaption>8 tables, all empty. Rows arrive only when the Wave 3 relays run. A tag in a box header says what a trigger lets happen after insert. The heavy boxes are the trade path.</figcaption>
  </figure>
  <h3>Schema finance</h3>
  <figure>
    <div class="scroll">{phys_finance()}</div>
    <figcaption>6 tables, all empty. No trade-path role will have access to this schema.</figcaption>
  </figure>
  <h3>Schema ops</h3>
  <figure>
    <div class="scroll">{phys_ops()}</div>
    <figcaption>6 tables. Only source_registry holds rows (14). The others stay empty until the watchdog relay, the bell library and the relays run in Wave 3.</figcaption>
  </figure>
  <div class="tscroll"><table>
    <thead><tr><th>Schema</th><th>Table</th><th>Grain, in one line</th><th>Key</th><th>Notable rules</th><th>In production now</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
  <h3>Roles and grants</h3>
  <p>The design has four database roles: an app role for the dashboard and control panel, a relay role for the writers, a research role, and a read-only role for analysis. Migration 021 creates them. <strong>It has not been applied in production</strong>, because creating roles needs the superuser password. Until then every new job connects as <strong>sa</strong>. The trade path has no database login in <strong>scalable_brain</strong> at all.</p>
  <h3>Service-private stores (SQLite)</h3>
  <ul class="inv">{sq}</ul>
</section>
"""


# ---------------------------------------------------------------- page content
ENTITIES = [
    ("Reference", "Strategy", "A rule set that proposes trades.",
     "Integer id in ForexBrainDB (67), text key in the research tables, a third form built in code; two more copies in the dashboard databases."),
    ("Reference", "Strategy Version", "One fixed set of code and parameters for a strategy, with the dates it applied.",
     "No table. Git history, a hand-set version string, a source hash on incubations."),
    ("Reference", "Risk Setting", "Limits, status and allocation for a strategy on an account, with the dates they applied.",
     "A config file, two tables in ams.db, weights in the live map. No history kept."),
    ("Reference", "Instrument", "A tradable market, such as EUR/USD or an index.",
     "An asset table in two databases, plus free-text instrument and pair columns; pair lists repeated in code."),
    ("Reference", "Account", "A broker account that holds money and trades.",
     "No table. One state row in ams.db; the live account is a database schema."),
    ("Reference", "Broker", "The firm an account is held at.", "No table. Implied by configuration (OANDA)."),
    ("Reference", "Environment", "Where something runs: production or development.",
     "No table. Folders, variables and database names; a column on two research tables only."),
    ("Trade path", "Signal", "A proposal to trade one instrument in one direction at one time.",
     "Ledger files, a signal log table, a research intent table, and a queue message that is purged."),
    ("Trade path", "Risk Decision", "The verdict on one signal: approved, reduced or rejected, with reasons.",
     "ams.db decision log, one row per signal."),
    ("Trade path", "Order", "An instruction sent to the broker.", "Queue messages (purged), system2.db, an order watch table."),
    ("Trade path", "Fill", "What the broker actually executed for an order.", "An outbox file, system2.db, the broker itself."),
    ("Trade path", "Trade", "A position from open to close, with its result.",
     "At least seven stores with different keys and counts."),
    ("Account state", "Equity Sample", "Balance and equity of an account at a moment.", "Five stores at three levels of detail."),
    ("Market", "Price Bar", "Open, high, low, close for an instrument and time step.",
     "ForexBrainDB (about 25 million rows); separate files for index and commodity research."),
    ("Market", "Regime", "The market state label for an instrument and time step.",
     "ForexBrainDB; a 9-row copy in the dashboard database."),
    ("Market", "External Data", "Macro series, calendar events, central-bank documents, positioning.",
     "Written in the dev database, copied to production."),
    ("Research", "Card", "The written promise made before a test: window, parameters, pass and kill rules.",
     "Card files in git and a research table."),
    ("Research", "Backtest Run", "One simulated run of a strategy version over history.",
     "Two engines with two result stores and no shared key."),
    ("Research", "Incubation", "Enrolment of a strategy in forward testing, with its status.",
     "A new nightly incubator in PostgreSQL and an older hourly one in SQLite that is mostly frozen."),
    ("Research", "Forward Trade", "A simulated trade recorded after registration, never rewritten.",
     "An append-only ledger, written in the dev database."),
    ("Operations", "Service", "A running program: Brain, Guardian, Hand, bridge, publisher, dashboard.", "Supervisor status files."),
    ("Operations", "Heartbeat", "Proof a service was alive at a moment.", "One file per service, overwritten; no history."),
    ("Operations", "Alert", "Something a person must be told.", "A Guardian outbox, the bell database, watchdog state."),
    ("Operations", "Operator Command", "An action the owner takes: pause, close, change a limit, deploy.",
     "An audit table in ams.db, the control panel database, dashboard commands."),
]

TROUBLE = [
    ("Production depends on the dev database.",
     "System 1 reads macro factors from scalable_brain_dev and the production research emitter writes its intents there. "
     "The research tables in scalable_brain are a reload copy of dev, and dev is not in the backup.", "reported"),
    ("One file carries every message, and finished messages are purged.",
     "After about 7 days there is no record of the signals, orders and account snapshots that crossed the queue.", "reported"),
    ("The risk ledger has several writers.",
     "Guardian, the bridge, the dashboard, a load script and one-off scripts all write ams.db. All five open positions "
     "carry strategy 41; the journal says two belong to strategies 36 and 21.", "checked"),
    ("Two jobs write the same trade table with different rules.",
     "The stores then disagree: the journal has 30 closed trades totalling -793.67; the daily summary has 28 totalling -748.02.", "checked"),
    ("The dashboard writes into the trade path.",
     "It inserts commands straight into the queue and edits strategy controls in the risk ledger, past the services that own them.", "reported"),
    ("The live strategy list is a file with hand-kept overrides.",
     "The map is rebuilt weekly, owner overrides are a hard-coded list in a script, and three copies of the map disagree.", "reported"),
    ("No alert leaves the screen.",
     "290 alerts were queued for Telegram and none was delivered. The dashboard bell is the only channel and clears itself after about 2 hours.", "checked"),
    ("A store nobody reads.",
     "system2.db is written on every order; no program was found that reads it.", "reported"),
    ("Liveness has no history.",
     "Each heartbeat overwrites one file, so uptime over time cannot be shown.", "reported"),
]

QUESTIONS = [
    "Are these the right 24 business things, and is anything missing or split wrongly?",
    "Should a signal belong to a strategy version, so that every trade can be traced to exact code and parameters?",
    "Should account and environment be plain attributes, so that a live or prop-firm account is one more row?",
    "Which store should own each thing? The trade and the strategy are the two with the most copies today.",
    "Should the dashboard read the owning store directly and show the age of every copy it relies on?",
]

CSS = r"""
/* Layout: one reading column of prose; figures break out to the full page width and scroll on their own. */
:root{
  color-scheme:dark;
  --bg:11 15 20; --surface:17 22 29; --surface-raised:23 29 38; --surface-sunken:8 11 15;
  --border:35 43 54; --border-strong:51 64 80; --text:230 234 240; --text-dim:167 176 190; --text-faint:107 118 134;
  --good:52 211 153; --bad:248 113 113; --warn:251 191 36; --accent:34 211 238; --neutral:148 163 184;
  --s1:129 140 248; --s2:244 114 182; --s3:192 132 252;
  --sans:"IBM Plex Sans",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){
  color-scheme:light;
  --bg:238 241 245; --surface:255 255 255; --surface-raised:246 248 250; --surface-sunken:227 231 237;
  --border:213 219 227; --border-strong:184 193 205; --text:16 24 40; --text-dim:65 75 90; --text-faint:93 107 126;
  --good:4 120 87; --bad:220 38 38; --warn:180 83 9; --accent:14 116 144; --neutral:100 116 139;
  --s1:67 56 202; --s2:190 24 93; --s3:126 34 206;
}}
:root[data-theme="light"]{
  color-scheme:light;
  --bg:238 241 245; --surface:255 255 255; --surface-raised:246 248 250; --surface-sunken:227 231 237;
  --border:213 219 227; --border-strong:184 193 205; --text:16 24 40; --text-dim:65 75 90; --text-faint:93 107 126;
  --good:4 120 87; --bad:220 38 38; --warn:180 83 9; --accent:14 116 144; --neutral:100 116 139;
  --s1:67 56 202; --s2:190 24 93; --s3:126 34 206;
}
*{box-sizing:border-box}
body{background:rgb(var(--bg));color:rgb(var(--text));font-family:var(--sans);font-size:15px;line-height:1.55;margin:0}
.wrap{max-width:1240px;margin:0 auto;padding-block:40px 72px;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));
  display:flex;flex-direction:column;gap:44px}
header{display:flex;flex-direction:column;gap:10px}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:rgb(var(--text-faint))}
h1{font-size:34px;line-height:1.15;font-weight:600;margin:0;letter-spacing:-.01em;text-wrap:balance}
h2{font-size:21px;line-height:1.25;font-weight:600;margin:0;text-wrap:balance}
p{margin:0;max-width:68ch;color:rgb(var(--text-dim))}
p strong,li strong{color:rgb(var(--text));font-weight:600}
section{display:flex;flex-direction:column;gap:16px;min-width:0}
.defs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1px;background:rgb(var(--border));
  border:1px solid rgb(var(--border));border-radius:8px;overflow:hidden}
.defs div{background:rgb(var(--surface));padding:14px 16px;display:flex;flex-direction:column;gap:4px;min-width:0}
.defs b{font-weight:600}
.defs span{color:rgb(var(--text-dim));font-size:14px}
figure{margin:0;display:flex;flex-direction:column;gap:10px;min-width:0}
.scroll{overflow-x:auto;background:rgb(var(--surface));border:1px solid rgb(var(--border));border-radius:8px;padding:12px}
.scroll svg{display:block;width:100%;min-width:1040px;height:auto;color:rgb(var(--text-dim));font-family:var(--sans)}
figcaption{font-size:13.5px;color:rgb(var(--text-dim));max-width:86ch}
.key{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:rgb(var(--text-dim))}
.key i{display:inline-block;width:26px;height:14px;vertical-align:-2px;margin-right:6px;border:1.25px solid rgb(var(--text-dim));background:rgb(var(--surface))}
.key i.kp{border-radius:7px}
.key i.ks{border-left:0;border-right:0;border-color:rgb(var(--border-strong));background:rgb(var(--surface-sunken))}
.key i.kx{border-width:1.75px;background:rgb(var(--surface-raised))}
.key i.kw{border:0;border-top:2px dashed rgb(var(--warn));height:0;vertical-align:4px;background:none}
/* svg marks */
svg .n{fill:rgb(var(--surface-raised));stroke:rgb(var(--border-strong));stroke-width:1}
svg .n.spine{stroke:rgb(var(--text));stroke-width:1.75}
svg .core{fill:rgb(var(--surface-raised));stroke:rgb(var(--text));stroke-width:1.75}
svg .pr{fill:rgb(var(--surface-raised));stroke:rgb(var(--text-dim));stroke-width:1.25}
svg .st{fill:rgb(var(--surface-sunken));stroke:none}
svg .stid{fill:rgb(var(--border));stroke:none}
svg .stl{stroke:rgb(var(--border-strong));stroke-width:1.5;fill:none}
svg .x{fill:rgb(var(--surface));stroke:rgb(var(--text-dim));stroke-width:1.75}
svg .x.bad{stroke:rgb(var(--bad));stroke-dasharray:5 4}
svg .x.off{stroke:rgb(var(--neutral));stroke-dasharray:5 4}
svg .e{stroke:rgb(var(--text-dim));stroke-width:1.25}
svg .e.spine{stroke:rgb(var(--text));stroke-width:2}
svg .e.warn{stroke:rgb(var(--warn));stroke-dasharray:5 4;stroke-width:1.5}
svg .e.bad{stroke:rgb(var(--bad));stroke-dasharray:5 4;stroke-width:1.5}
svg .e.off{stroke:rgb(var(--neutral));stroke-dasharray:5 4}
svg .mh{fill:rgb(var(--text-dim))} svg .mh.spine{fill:rgb(var(--text))}
svg .mh.warn{fill:rgb(var(--warn))} svg .mh.bad{fill:rgb(var(--bad))} svg .mh.off{fill:rgb(var(--neutral))}
svg text{fill:rgb(var(--text-dim))}
svg .nm{font-size:13px;font-weight:600;fill:rgb(var(--text))}
svg .nm.mono{font-family:var(--mono);font-size:12px;font-weight:500}
svg .ttl{font-size:19px;font-weight:600;fill:rgb(var(--text))}
svg .eb{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;fill:rgb(var(--text-faint))}
svg .sb{font-size:10.5px;fill:rgb(var(--text-dim))}
svg .sb.strong{font-size:11.5px;fill:rgb(var(--text))}
svg .sid{font-family:var(--mono);font-size:10px;fill:rgb(var(--text-dim))}
svg .el{font-size:10.5px;fill:rgb(var(--text-dim))}
svg .el.warn{fill:rgb(var(--warn))} svg .el.bad{fill:rgb(var(--bad))} svg .el.off{fill:rgb(var(--neutral))}
svg .s1{fill:rgb(var(--s1))} svg .s2{fill:rgb(var(--s2))} svg .s3{fill:rgb(var(--s3))}
svg .dot{fill:rgb(var(--border-strong))} svg .dot.s1{fill:rgb(var(--s1))} svg .dot.s2{fill:rgb(var(--s2))} svg .dot.s3{fill:rgb(var(--s3))}
svg .bd{stroke:rgb(var(--bg));stroke-width:2} svg .bd.warn{fill:rgb(var(--warn))} svg .bd.bad{fill:rgb(var(--bad))}
svg .bt{font-family:var(--mono);font-size:11px;font-weight:600;fill:rgb(var(--bg))}
svg .nm.sm{font-size:12px}
svg .fr{fill:none;stroke:rgb(var(--border-strong));stroke-width:1.25}
svg .fr.mute{stroke:rgb(var(--neutral));stroke-dasharray:6 4}
svg .fh{font-family:var(--mono);font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;fill:rgb(var(--text))}
svg .fh.mute{fill:rgb(var(--neutral))}
svg .fs{font-size:10.5px;fill:rgb(var(--text-faint))}
svg .vm{fill:rgb(var(--accent));stroke:rgb(var(--bg));stroke-width:1.5}
svg .vt{font-family:var(--mono);font-size:10px;font-weight:700;fill:rgb(var(--bg))}
svg .tb{fill:rgb(var(--surface-raised));stroke:rgb(var(--border-strong));stroke-width:1}
svg .tb.spine{stroke:rgb(var(--text));stroke-width:1.5}
svg .tbh{fill:rgb(var(--border));stroke:none}
svg .cl{font-family:var(--mono);font-size:10px;fill:rgb(var(--text))}
svg .cn{font-family:var(--mono);font-size:10px;fill:rgb(var(--text-faint))}
svg .tg{font-family:var(--mono);font-size:9px;fill:rgb(var(--text-faint))}
svg .mk{font-family:var(--mono);font-size:8.5px;font-weight:700;fill:rgb(var(--text-faint))}
svg .mk.pk{fill:rgb(var(--accent))} svg .mk.fk{fill:rgb(var(--warn))} svg .mk.uq{fill:rgb(var(--neutral))}
.key b{font-family:var(--mono);font-size:11px;margin-right:6px}
.key b.kv{display:inline-block;width:16px;height:16px;border-radius:50%;text-align:center;line-height:16px;background:rgb(var(--accent));color:rgb(var(--bg));font-size:10px}
.key b.kpk{color:rgb(var(--accent))} .key b.kfk{color:rgb(var(--warn))} .key b.kuq{color:rgb(var(--neutral))}
h3{font-size:16px;line-height:1.3;font-weight:600;margin:8px 0 0}
ul.inv{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;max-width:86ch;color:rgb(var(--text-dim))}
td.entw{font-weight:600}
/* tables and lists */
.tscroll{overflow-x:auto;border:1px solid rgb(var(--border));border-radius:8px;background:rgb(var(--surface))}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:14px}
th,td{text-align:left;vertical-align:top;padding:9px 14px;border-bottom:1px solid rgb(var(--border))}
th{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:500;color:rgb(var(--text-faint));background:rgb(var(--surface-raised))}
tr:last-child td{border-bottom:0}
td.dom{font-family:var(--mono);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:rgb(var(--text-faint));white-space:nowrap}
td.ent{font-weight:600;white-space:nowrap}
td.now{color:rgb(var(--text-dim))}
ol.trouble{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:1px;
  background:rgb(var(--border));border:1px solid rgb(var(--border));border-radius:8px;overflow:hidden}
ol.trouble li{background:rgb(var(--surface));padding:14px 16px;display:grid;grid-template-columns:26px 1fr;gap:4px 10px;min-width:0}
ol.trouble .num{grid-row:span 2;width:22px;height:22px;border-radius:50%;background:rgb(var(--warn));color:rgb(var(--bg));
  font-family:var(--mono);font-size:12px;font-weight:600;display:grid;place-items:center}
ol.trouble .num.bad{background:rgb(var(--bad))}
ol.trouble span.d{color:rgb(var(--text-dim));font-size:14px}
.tag{font-family:var(--mono);font-size:10.5px;letter-spacing:.04em;text-transform:uppercase;color:rgb(var(--text-faint));margin-left:6px;white-space:nowrap}
.tag.ok{color:rgb(var(--good))}
ol.q{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:8px;max-width:76ch;color:rgb(var(--text-dim))}
footer{font-size:13px;color:rgb(var(--text-faint));border-top:1px solid rgb(var(--border));padding-top:16px;max-width:86ch}
"""


def page():
    rows = "".join(
        f'<tr><td class="dom">{esc(d)}</td><td class="ent">{esc(n)}</td><td>{esc(w)}</td><td class="now">{esc(t)}</td></tr>'
        for d, n, w, t in ENTITIES)
    trouble = "".join(
        f'<li><span class="num{" bad" if i == 7 else ""}">{i}</span><strong>{esc(t)}'
        f'<span class="tag{" ok" if s == "checked" else ""}">{"re-checked" if s == "checked" else "from discovery"}</span></strong>'
        f'<span class="d">{esc(d)}</span></li>'
        for i, (t, d, s) in enumerate(TROUBLE, 1))
    qs = "".join(f"<li>{esc(q)}</li>" for q in QUESTIONS)
    return f"""<title>Scalable Brain Data Blueprint</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>{CSS}</style>
<div class="wrap">
<header>
  <div class="eyebrow">Scalable Brain · data architecture · draft for review · 16 Nov 2026</div>
  <h1>Data Blueprint</h1>
  <p>Four views of the same system. The conceptual model says what the business things are and how they relate, with no tables and no technology. The data flow diagrams say where data enters, which program moves it and where it rests today. The logical model gives each thing one owning store, with keys and history rules. The physical model shows the tables now built in production.</p>
</header>

<section>
  <div class="defs">
    <div><b>Conceptual model</b><span>The things the business cares about and the relationships between them. It is the target every store is measured against.</span></div>
    <div><b>Data flow, context</b><span>The system as one box, and everything outside it that sends or receives data.</span></div>
    <div><b>Data flow, level 1</b><span>The inside of the box: programs, stores and the data moving between them, as it runs today.</span></div>
    <div><b>Logical model</b><span>The same things placed in four owning stores (config, trading, finance, ops), with keys, history rules and one writer each.</span></div>
    <div><b>Physical model</b><span>The tables, keys and rules as built in production on 16 November 2026. The trade path does not read them yet.</span></div>
  </div>
</section>

<section>
  <h2>Conceptual model</h2>
  <p>Read the heavy row first: a <strong>signal</strong> is judged by a <strong>risk decision</strong>, which approves an <strong>order</strong>; the order is <strong>filled</strong>, and fills update a <strong>trade</strong>. Everything else either feeds that row or describes it.</p>
  <figure>
    <div class="scroll">{conceptual()}</div>
    <figcaption>Each box is one business thing; the small label is its domain. An arrow reads as a sentence from tail to head, for example "Card registers Strategy". A trade has no arrow to a strategy on purpose: its strategy is reached through its order, decision and signal, so it can never disagree with them.</figcaption>
  </figure>
  <div class="tscroll"><table>
    <thead><tr><th>Domain</th><th>Thing</th><th>What it is</th><th>Where it lives today</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
</section>

<section>
  <h2>Data flow, context</h2>
  <p>One PC holds everything. The practice broker account is the only place orders go. Two outputs are meant to exist and do not work yet, and two kinds of account are not connected.</p>
  <figure>
    <div class="scroll">{context()}</div>
    <figcaption>Solid lines carry data today. Dashed red is configured but failing. Dashed grey is not connected.</figcaption>
  </figure>
</section>

<section>
  <h2>Data flow, level 1, as it runs today</h2>
  <p>Signals from two producers meet on one queue. Guardian, the bridge and Hand pass orders and fills over that same queue, and only Hand talks to the broker. Everything below the trade path is copying and watching.</p>
  <div class="key">
    <span><i class="kp"></i>Program</span><span><i class="ks"></i>Data store</span><span><i class="kx"></i>Outside party</span>
    <span><i class="kw"></i>Flow that crosses a boundary it should not</span>
  </div>
  <figure>
    <div class="scroll">{flow1()}</div>
    <figcaption>Numbered marks are trouble spots, listed below. System colours follow the dashboard: Brain, Hand, Guardian. The older hourly incubator, the weekly retrain, backups and the DEV runtime are left out to keep the picture readable; they are in the discovery files.</figcaption>
  </figure>
  <ol class="trouble">{trouble}</ol>
</section>

{logical_section()}
{physical_section()}
<section>
  <h2>Questions for the reviewer</h2>
  <ol class="q">{qs}</ol>
</section>

<footer>Built from a read-only discovery of the system on 13 and 14 November 2026. Items marked "re-checked" were confirmed by a second direct query; items marked "from discovery" are as reported by the discovery pass and carry file and line evidence in the discovery files. Nothing in any database or service was changed to produce this page.</footer>
</div>
"""


SITE_OUT = Path(__file__).resolve().parents[2] / "data-blueprint.html"
TOKENS = ["bg", "surface", "surface-raised", "surface-sunken", "border", "border-strong", "text", "text-dim",
          "text-faint", "good", "bad", "warn", "accent", "neutral", "s1", "s2", "s3"]


def site_css():
    """The page CSS for the architecture site: the site already loads tokens.css, Plex and body styles,
    and inside <body> main.css reuses the token names as plain colours. So drop this page's own token
    blocks and body rule, and read every colour through --bp-* names computed on :root from the channels."""
    import re
    css = CSS[CSS.index("*{box-sizing"):]
    css = re.sub(r"body\{[^}]*\}\n", "", css, count=1)
    css = re.sub(r"rgb\(var\(--([a-z0-9-]+)\)\)", r"var(--bp-\1)", css)
    root = ":root{" + "".join(f"--bp-{t}:rgb(var(--{t}));" for t in TOKENS) + "}\n"
    return root + css


def site_page():
    body = page()
    body = body[body.index('<div class="wrap">'):]
    body = body.replace('<div class="wrap">', '<main id="main" class="wrap">', 1)
    body = body[: body.rindex("</div>")] + "</main>"
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Data Blueprint · Conceptual, Logical and Physical Models, Data Flow — Scalable Brain</title>
<meta name="description" content="Conceptual, logical and physical data models and data flow diagrams for Scalable Brain. The physical model is the schema built in production on 16 November 2026. Draft for review.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="assets/css/main.css">
<style>
{site_css()}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header id="site-header"></header>
<!-- Generated by data-model/tools/build_blueprint.py. Edit that file and run it; do not edit this page by hand. -->
{body}
<footer id="site-footer"></footer>
<script type="module" src="assets/js/data-blueprint.js"></script>
</body>
</html>
"""


if __name__ == "__main__":
    OUT.write_text(page(), encoding="utf-8")
    print(OUT, OUT.stat().st_size)
    SITE_OUT.write_text(site_page(), encoding="utf-8")
    print(SITE_OUT, SITE_OUT.stat().st_size)
