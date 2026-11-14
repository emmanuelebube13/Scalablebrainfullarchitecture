"""Builds data-model/blueprint.html: the conceptual model and the data flow diagrams.

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
.defs{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1px;background:rgb(var(--border));
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
  <div class="eyebrow">Scalable Brain · data architecture · draft for review · 14 Nov 2026</div>
  <h1>Data Blueprint</h1>
  <p>Two views of the same system. The conceptual model says what the business things are and how they relate, with no tables and no technology. The data flow diagrams say where data enters, which program moves it and where it rests today.</p>
</header>

<section>
  <div class="defs">
    <div><b>Conceptual model</b><span>The things the business cares about and the relationships between them. It is the target every store is measured against.</span></div>
    <div><b>Data flow, context</b><span>The system as one box, and everything outside it that sends or receives data.</span></div>
    <div><b>Data flow, level 1</b><span>The inside of the box: programs, stores and the data moving between them, as it runs today.</span></div>
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
<title>Data Blueprint · Conceptual Model and Data Flow — Scalable Brain</title>
<meta name="description" content="Conceptual model and data flow diagrams for Scalable Brain, drawn from a read-only discovery of the running system. Draft for review.">
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
