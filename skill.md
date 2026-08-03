# 🏸 AI Instruction: Working Directory for Badcount App

When working on the **BadCount** Badminton Session Tracker application in this workspace, **always** use and perform operations within the following directory:

📁 **Target Directory:**
`C:\Users\Ball\Desktop\Claude\Badminton\Badcount`

---
> [!IMPORTANT]
> Do not make edits or execute commands in parent folders or other adjacent directories unless explicitly instructed. Always target the path specified above when the user asks about the Badcount app.

---

# 🏠 AI Instruction: Home Assistant Development (ทำ HA)

When the user asks to work on **Home Assistant** (or says **"ทำ HA"**), **always** refer to this instruction block and operate within the Home Assistant workspace directory.

📁 **Target Directory:**
`C:\Users\Ball\Desktop\Claude\homeassistant`

> [!IMPORTANT]
> **การจัดการ Dashboard Badges ( MB Home / View 0 )**:
> ห้ามเพิ่ม Badge อื่นๆ เข้าไปใน Dashboard เด็ดขาด! บน Dashboard (ทั้ง favorite และ test) จะต้องมี **แค่ 3 Badges นี้เท่านั้น**:
> 1. **Light Badge** (รายงานจำนวนไฟที่เปิด)
> 2. **Alert On Badge** (ปุ่มเปิดระบบกันขโมย)
> 3. **Alert Off Badge** (ปุ่มปิดระบบกันขโมย)
> ห้ามมี Badge อื่นๆ เช่น ประตู, หน้าต่าง, สวิตช์วาล์วน้ำ, โทรศัพท์ หรือสภาพอากาศ โผล่มาที่หน้าหลักเด็ดขาด!

> [!IMPORTANT]
> หากได้รับคำสั่งให้อัปเดต skill หรือดึงข้อมูล skill ไปใช้งาน ให้ทำการอัปเดต/ดึงข้อมูลจากโฟลเดอร์นี้เท่านั้นสำหรับส่วนของ HA:
> `C:\Users\Ball\Desktop\Claude\Portable HA Skill`

---
name: home-assistant-control
description: >-
  Control and automate Ball's Home Assistant instance (at http://192.168.3.31:8123) entirely
  through its HTTP/WebSocket API from this Windows machine — no UI clicking needed. Use this
  skill WHENEVER the user mentions Home Assistant, HA, "บ้าน"/smart home control, Tuya or
  LocalTuya devices, migrating Tuya devices from cloud to local, light groups / switch_as_x,
  building or editing Lovelace/ULM/Mushroom dashboards, creating HA automations, controlling
  lights/switches/fans/gates/AC, or device presence (phones). Also trigger when the user says
  things like "เปิด/ปิดไฟ", "ย้ายเข้า local", "ทำ automation", "สร้าง dashboard", or references
  device names like Gate, Bedroom Head Lamp, Living room, gateways. It bundles ready-made Python
  scripts and hard-won playbooks so the work can resume and continue from where it left off.
---

# Home Assistant Control

This skill operates Ball's Home Assistant (HA) home over its API. Everything here was built and
verified live. The goal: resume any HA task — control, Tuya→LocalTuya migration, dashboards,
automations — without re-deriving how.

## 0. First thing every session: locate the working folder

The live scripts AND the secrets file (`.env`) live at:

```
C:\Users\Ball\Desktop\Claude\homeassistant\
```

**Always run scripts from there** (they import each other and read `.env` from their own folder).

### 🆕 Portable setup on a NEW machine (e.g. Ball's laptop) — this skill is self-contained
Everything needed is bundled in this skill. To stand it up on a fresh machine:
1. **Pick a working folder**, any path (e.g. `C:\Users\<you>\ha\`). The scripts use relative imports
   and read `.env` from their own folder, so the path doesn't matter — they just must all sit together.
2. **Copy this skill's entire `scripts/` folder** into that working folder (61 `.py` files).
3. **Create `.env`** in that same folder with the real keys from **`references/credentials.md`**
   (copy the dotenv block verbatim).
4. **Install Python deps:** `python -m pip install tinytuya websocket-client zeroconf`
   (Python 3.11+; `requests` not needed — scripts use stdlib `urllib`).
5. **Be on the same LAN** as HA — `HA_URL` is `192.168.3.31:8123` (no Nabu Casa → no remote access).
   tinytuya LAN scans, camera RTSP, and Midea local control all need same-subnet (192.168.3.x).
6. Verify: `python ha.py ping` → `{'message': 'API running.'}`.

**Windows console quirk:** the default console (cp1252) crashes on Thai output. Prefix every
command with `$env:PYTHONIOENCODING="utf-8"` (PowerShell). On macOS/Linux laptops this isn't needed.

Quick connectivity check (from the working folder):
```powershell
$env:PYTHONIOENCODING="utf-8"; python ha.py ping
```

## 1. What's in `.env`

`HA_URL` (http://192.168.3.31:8123), `HA_TOKEN` (long-lived), Tuya cloud creds
`TUYA_API_ID` / `TUYA_API_SECRET` / `TUYA_API_REGION` (us), and Aqara cloud creds `AQARA_*`
(for the FP2 / Aqara-cloud integration — see `references/aqara-cloud-cameras.md`).
👉 **The REAL values are bundled in `references/credentials.md`** (this is Ball's own portable skill).
`references/env.example.md` is the blank template (for sharing). To make a new HA token: HA →
profile → Security → Long-Lived Access Tokens. ⚠️ This skill folder contains live secrets — keep private.

## 2. The toolbox (all in the working folder)

| Script | Use |
|--------|-----|
| `ha.py` | CLI: `ping`, `list [domain]`, `state <eid>`, `on/off <eid>`, `domains` |
| `ha_client.py` | `HAClient` REST class (get_states, call_service, turn_on/off) + `load_env` |
| `ha_ws.py` | WebSocket API: `entries [domain]`, `devices <integration>`, `entities <device_id>` |
| `ha_flow.py` | Drive config/**options** flows step-by-step (set `HA_FLOW_RAW=1` to dump schemas) |
| `ws_raw.py` | Send ONE raw WS command, print full result — for probing/registry edits |
| `ha_lovelace.py` | Read Lovelace: `dashboards`, `resources`, `config [url]`, `entities [url]` |
| `tuya_keys.py` | Pull all Tuya local keys from cloud (tinytuya) |
| `tuya_inventory.py` | WiFi switch/light devices (scan IP + cloud category + in-LocalTuya) |
| `remaining_to_migrate.py` | What's still on cloud, bucketed (WiFi/Zigbee/IR/sensor/offline) |
| `explore_cloud.py` | Sub-devices of a gateway + their node_id (`<gateway_id>`) |
| `diagnose_device.py` | Test one device's local key/connection (`<device_id>`) |
| `batch_add_localtuya.py` | Add WiFi switch/light/socket devices to LocalTuya (`dry`/run) |
| `batch_add_subdevices.py` | Add a gateway's Zigbee children (`<gateway_id> [dry/all]`) |
| `cleanup_duplicates.py` | Fix `_2` name collisions (local takes clean id, cloud disabled) |
| `find_remaining_dupes.py` | Find cloud dupes by Tuya device_id |
| `repoint_helpers.py` | (mostly superseded — see gotcha #4) |
| `recreate_switch_as_x.py` | **The real fix** for switch_as_x after migration (see #4) |
| `reload_switch_as_x.py` | Reload switch_as_x/group config entries |
| `build_ulm_dashboard.py` | Build the ULM-style dashboard `/ulm-home` from Favorite entities |
| `create_automations.py`, `create_bedroom_automations.py` | Automation examples via REST config API |
| `repair_localtuya_ips.py` | Auto-heal LocalTuya device IPs after a router/IP change (scan→compare→fix) |
| `scan_broken_automation_refs.py` | Find automations referencing disabled/`_cloud`/dangling entities |
| `generate_ip_list.py` / `generate_mac_list.py` | Build DHCP-reservation IP/MAC tables to Desktop |

**The table above is the reusable core.** `scripts/` contains one-off task builders, named by what they do: `create_*` (automations), `update_*`/`fix_*`/`rebuild_*` (dashboard tweaks), `*_detail.py` (subviews), `add_*`/`*_debug.py` (device-add helpers). Open one and read it as a worked example when doing a similar task — they all share the `ha_client` / `ha_ws` / `ha_flow` plumbing.

`tinytuya` + `websocket-client` are installed (`python -m pip install tinytuya websocket-client`).

## 3. Core capabilities (how to do each)

### Control / inspect devices
`python ha.py list light` (or switch/fan/climate…), `state <eid>`, `on/off <eid>`.
For anything REST can't show (integrations, device/entity registry): `ha_ws.py`.

### Find entities
`python ha.py list 2>&1 | Select-String "keyword"`. Friendly names come from the registry.

### Migrate Tuya devices cloud → LocalTuya (no UI)
Full procedure + every gotcha is in **`references/migration-playbook.md`** — read it before migrating.
TL;DR: scan LAN → match keys → drive LocalTuya's options-flow (`ha_flow.py` mechanics) via
`batch_add_localtuya.py` (WiFi) or `batch_add_subdevices.py` (Zigbee behind a gateway).

### Build / edit dashboards
`build_ulm_dashboard.py` creates `/ulm-home` with `custom:button-card` (ULM aesthetic). button-card
is installed via HACS API + resource registered. Read `references/dashboards.md`.

### Create automations
POST to `/api/config/automation/config/<id>` with a JSON config (classic `platform:`/`service:`
format is safest). See `create_automations.py` / `create_bedroom_automations.py` for working
patterns (presence→gate, light-sync). HA auto-reloads; entity becomes `automation.<alias_slug>`.

## 4. Critical gotchas (learned the hard way — don't repeat)

1. **`getdevices(verbose=True)` puts the key in field `local_key`, not `key`** (which is empty).
   Always `d.get("local_key") or d.get("key")`.
2. **Protocol version**: never submit `auto` for v3.5 devices — the connect fails silently
   (empty `ex`). Use the version from the LAN scan.
3. **LocalTuya add-device flow**: send only `selected_device` (adding `mass_configure` errors after
   the first add). For dropdown devices, reuse the form's `suggested_value` (LocalTuya's own cloud
   key is current; the tinytuya project key can be stale → "localkey incorrect"). Devices not in
   the dropdown (e.g. bulbs on another Tuya account) → `selected_device:"..."` (manual). Devices
   take ONE local connection at a time → 4s delay between adds; transient "base: unknown" → retry.
4. **switch_as_x binds to the source's REGISTRY ENTITY, not the entity_id string — and FOLLOWS
   renames.** So the "rename local to take the cloud id" trick does NOT move switch_as_x to local;
   it followed the cloud entity to `_cloud` (disabled) and every light group went `unavailable`.
   The correct fix is `recreate_switch_as_x.py`: delete each switch_as_x helper and recreate it via
   config flow pointing at the LOCAL switch, then rename it back to the original entity_id.
   **Rule:** dashboards/groups/automations reference entity_id STRINGS (rename trick OK); helpers
   (switch_as_x/template/group) bind by registry id (must RECREATE, not rename).
5. **Gateways** (category `wg2`) can't be auto-configured ("Couldn't find data for category wg2")
   and don't need to be — add the Zigbee CHILDREN directly: they connect via the gateway's IP +
   their `node_id` (auto-filled), sharing the gateway's `local_key`.
6. **Battery Zigbee sensors/buttons** (pir/mcs/hps/wxkg/sj) are unreliable over LocalTuya local
   polling — leave them on cloud unless asked.

## 5. State of the world (as of last session)

LocalTuya has ~44 devices; all online controllable Tuya run local. The "Favorite" dashboard
(`dashboard-favorite`) is the main one the user edits — view 0 "Active Button" holds the badges; it
also has subviews `lights-detail`, `gate-detail`, `doorlock-detail`, etc. `/ulm-home` also exists.

**Session 2 additions** (details in the reference files):
- **2 battery-Zigbee presence sensors migrated to LocalTuya** — `binary_sensor.garage_presence_sensor`,
  `binary_sensor.bath_bedroom_tuya_presence_sensor` (gateways stayed healthy).
- **Automations**: Master-Bedroom-Bath (light 5pm–midnight, fan 5/15 min), Garage Seat↔Downlight,
  Garage Cabinet↔presence. FP2→Dining-Chandelier built by the user via Matter signals.
- **Scenes + badges**: `scene.good_night` (all downstairs lights + living AC off) and
  `scene.arrived_home` (8 lights on + A9 level 7 + close curtains), triggered by 2 dashboard badges.
- **Aqara cameras**: `camera.g5_garage` via RTSP→go2rtc (Generic Camera), live card in gate-detail.
- **Aqara FP2 / cloud**: installed Darkdragon14 `ha-aqara-devices` + RocketMQ bridge add-on; auth works,
  191 entities incl FP2 30-zone — but the live event stream is **PARKED/unverified** (hairpin +
  subscription). User uses FP2 **Matter** occupancy entities instead. Full saga in
  `references/aqara-cloud-cameras.md`.
- **Dashboard**: doorlock-detail switched to native history-graph+logbook; A9 fan tiles relabeled
  "Level X/9" via card-mod; 3 scenes consolidated into one "Scenes" badge → `scenes-detail` subview;
  AC/Fan/Purifier sections gained per-category subviews (controls + on/off `history-graph` timeline +
  logbook) reached by tapping the section heading.
- **LG webOS TV control**: status via `media_player.lg_webos_tv_qned86sra` (unavailable=off),
  turn-on via a `wake_on_lan` config-entry button (`button.lg_tv_wake`, MAC 64:E4:A5:76:10:45),
  one-tap `script.lg_tv_power` toggle. (Good Night + Leave scenes also turn it off.) See automations.md.

**Session 3 additions:**
- **`scene.leave_home_with_corrine`** = Good Night + fans/purifiers off (see automations.md). ⚠️
  Removed the 2 **FingerBot** fans (`*_fingerbot_*`) from it — FingerBots are blind button-pressers
  (switch_as_x, click-mode) that just TOGGLE; a scene "off" clicks them → fan turns ON. To get a real
  on/off state for a FingerBot fan you need an external sensor (power-monitoring plug ⭐ or an Aqara
  vibration sensor) — the FingerBot can't self-sense.
- **Gate GPS-flap fix** (see automations.md): the gate opened by itself from a phone presence flap.
  An away-duration condition using `trigger.from_state.last_changed` does NOT work (GPS trackers
  refresh `last_changed` constantly) — it blocked a real arrival. Reverted. Real fix = enlarge the
  Home zone radius (100m is tight); zone.home is core config (not in `zone/list`), edit via UI.
- **BYD car** (byd_vehicle / jkaberg HACS): was added (cloud login + control PIN, 133 entities incl
  GPS, climate, lock) then **REMOVED at Ball's request** (cloud lag + prefers the BYD app). If re-adding:
  HACS repo `jkaberg/hass-byd-vehicle`, country Thailand works, connection health = `binary_sensor.*_online`
  + `sensor.*_telemetry_last_updated` age (cloud poll ~5 min → lock/door status lags & misses transient events).
- **Midea Laundry Fan keeps dropping** = `midea_ac_lan` (LOCAL) and the device's **IP changed** (was
  `.42`, moved to `.155`) — app works (cloud) but HA local fails. Fix: midea entry **options flow →
  update `ip_address`** then reload. PERMANENT fix = DHCP-reserve it (MAC `d4:50:ee:63:12:d5`).
  A watchdog `automation.midea_laundry_fan_auto_reconnect_watchdog` reloads the entry when unavailable
  ≥15 min (helps stuck connections, NOT IP changes).

**Session 4 additions:**
- **Xiaomi Integration Auto-Reload**: Deployed `automation.xiaomi_home_auto_reload_when_unavailable` to automatically reload the `xiaomi_home` integration entry when the permanently powered Closet AC goes offline/unavailable for 3 minutes (preventing SSL unexpected EOF issues after router resets).
- **Offline Lights Highlights**: Updated `lights-detail` view cards with dynamic `card_mod` styles to display a red cross icon (`mdi:close-circle` in `#ef4444`) on any offline/unavailable light entity.
- **EV Charger Real-Time energy**: Exposed DP 9 (`power_total`) as `sensor.ev_charging_station_ev_charging_station_power` (W). Set up a left Riemann Sum Integral sensor (`sensor.ev_charging_station_realtime_energy` in kWh) and re-pointed daily (`sensor.ev_charging_station_ev_charging_daily`) and monthly utility meters to it, enabling real-time kWh tracking on the EV Charger dashboard badge.
- **Alert Badges Styling**: Customized "Alert On" (Blue Shield, blue border, blue tint, 1.08 scale) and "Alert Off" (Purple Crossed Bell, purple border, purple tint, 1.08 scale) template badges.

**Session 5 additions:**
- **Editing a LocalTuya climate's DP map WITHOUT the UI** (reusable technique, see dashboards.md):
  the xZetsubou localtuya entry data is NOT exposed via WS, but `GET /diagnostics/config_entry/<entry_id>`
  returns the full `data.devices{}` (DP strings + per-entity config). To change an entity's config, drive the
  **options flow** programmatically: `init → next_step_id=edit_device → selected_device=<tuya_id> →
  configure_device (echo every suggested_value) → one configure_entity form per entity (echo suggested,
  override/omit only your field) → create_entry`. Echoing suggested_value = "click Next unchanged"; a wrong/
  missing field only errors that step (no commit) so abort is safe. ALWAYS back up first (save diagnostics
  `data` to a file). Used for: StudyRoom **`heuristic_action:true`** (makes the 🕐 idle clock show by
  TEMP not compressor_freq — Daikin inverters rarely hit freq=0); Living **removed then re-added
  `swing_horizontal_dp:102`** (the remote's **"Louver" button = horizontal/left-right vane**; "Vane"=vertical
  DP101). LocalTuya entry id `01KT5ZWFDHAVM4SXKV92H7VY65`. Tuya ids: Living(Mitsubishi)=`eb11627093d763b7bdkq1f`,
  Master(Daikin)=`ebc291fc2142fc86aat4mm`, StudyRoom(Daikin)=`ebca72722669449799qmp9`.
  - Daikin **S21 WiFiKIT-II (Tuya, conn_dk_s21, category ktkzq)** exposes ONLY power/mode/temp/fan/swing/led/
    beep — **NO Powerful/Comfort/Sensor DP** (confirmed via tinytuya `cloud.getfunctions`/`getproperties`).
    Those remote buttons need a genuine Daikin BRP WiFi adapter, not this kit.
- **Imou cameras keep dropping (`OP1013: ...exceed limit (total)`)** = Imou Open Platform **free API quota
  exhausted** (resets ~daily, China time UTC+8). Not a bug. Mitigation set in imou_life **options flow**:
  `live_resolution=SD` (H.264 substream → fixes **iPad/iOS black-screen**; HD=H.265 which iOS can't decode),
  `update_interval=900` (max, ~3× fewer calls). Do **NOT** add an auto-reload watchdog (retries burn quota).
  Real fix = request higher quota on open.imoulife.com or use fewer cameras.
- **Apple TV (apple_tv built-in, "Living Room", Apple TV 4K gen3)**: power control via `media_player.turn_on/
  turn_off` does NOT sleep this device, and `power_state` reporting is broken (pyatv error *"Could not fetch
  SystemStatus ... FetchAttentionState failed"* — a tvOS limitation, NOT fixable by re-pairing). **Working
  on/off = `remote.send_command` with `command: wakeup` (on) / `suspend` (off)** → wrapped in
  `script.apple_tv_on` / `script.apple_tv_off`. Re-pairing: apple_tv has no reconfigure step & user-add says
  `already_configured`, so to refresh creds **delete the entry then re-add via config flow** (handler
  `apple_tv`, step `user` device_input="Living Room" → confirm → `pair_with_pin` × each protocol
  AirPlay/Companion/RAOP, submit `{"pin":NNNN}` each). Entities keep same ids (keyed on MAC 52:65:2C:2D:21:86):
  `media_player.apple_tv_living_room`, `remote.apple_tv_living_room`. State display stays unreliable; commands work.
- **Scheduler (on/off timers, once/daily) via HACS**: installed `nielsfaber/scheduler-component` +
  `scheduler-card` (HACS download → restart → config flow handler `scheduler`). Per-AC timer lives in
  per-AC subviews (`ac-living/ac-studyroom/ac-master/ac-closet`, each: thermostat + `custom:scheduler-card`
  `include:[that climate]` + timeline). AC main tiles: **tap=more-info (shows Mode/Fan/Swing), hold=navigate**
  to the per-AC subview (don't set tap=navigate — it hides the climate functions behind ⋮).
- **More automations** (see automations.md): `automation.lg_thinq_auto_reload_when_unavailable` (both PuriCare
  fans unavailable 3min → reload smartthinq entry `01KT74TX5ZESBDRCK1FX1W5C6G`); `gate_fp1e_night_trigger_once`
  (FP1E stair detect, 22:00–01:30, gate open, once/12h → pulse `switch.gate`); Master AC mini-switch
  (`event.aqara_wireless_mini_switch_button_2`, multi_press_1=on / multi_press_2=off).
- **EV "Power (live)" apexcharts** added to `ev-detail` (sensor `..._ev_charging_station_power`, W, stepline) —
  drops to 0 when charging stops (vs the cumulative Daily kWh graph which only plateaus).
- **app:// launcher** technique (mobile-only): chip/heading-badge `tap_action: url, url_path: app://<pkg>` +
  `visibility:[{condition:screen, media_query:"(max-width:768px)"}]`. LG ThinQ = `app://com.lgeha.nuts`,
  Aqara = `app://com.lumiunited.aqarahome.play`. Works on Android companion only.

**Session 6 additions:**
- **On-screen TOUCHPAD remotes via `Nerwyn/universal-remote-card`** (HACS plugin v4.x, installed via `hacs/repository/download {repository:654393646}`; no restart for plugins). A touchpad element = swipe up/down/left/right + tap(center) + hold, each mapped to actions. Config: `{type: custom:universal-remote-card, remote_id: <remote.entity>, custom_actions:[{type:touchpad, name:touchpad, tap_action:<select>, hold_action:<menu>, up/down/left/right:{tap_action:<dir>, hold_action:{action:repeat}}}], rows:[["touchpad"]]}`. Built two subviews on dashboard-favorite (+ synced to dashboard-test): `appletv-remote` and `lg-tv-remote`, reached via heading badges on the TV card.
  - **Apple TV remote**: actions = `remote.send_command` on `remote.apple_tv_living_room` (commands: up/down/left/right/select/menu/play_pause/skip_backward/skip_forward/suspend/wakeup). Buttons wired through `script.apple_remote` (one param `command`, call-service — NOT perform-action; the LG-style call-service+script path is the proven-reliable one here). Power: `script.apple_tv_on`=wakeup, `script.apple_tv_off`=suspend (media_player.turn_on/off do NOT sleep this Apple TV). **Profile/Control Center** = `script.apple_control_center` → `remote.send_command home` with **`hold_secs:1.5`** (pyatv `home_hold` does NOT open Control Center; a long-held `home` does). **Home button** = `script.apple_tv_home`: switches LG TV input to **"Apple OTT"** then sends home — emulates the real remote's HDMI-CEC behavior. It uses a `choose` (only select_source + 1s delay if NOT already on Apple OTT) to avoid a 1s lag when already on Apple TV.
  - **LG TV remote**: LG webOS has **NO `remote` entity** — control via service **`webostv.button`** `{entity_id, button: UP/DOWN/LEFT/RIGHT/ENTER/BACK/HOME/MENU/EXIT/REWIND/FASTFORWARD/...}`. Volume = `media_player.volume_up/down` + `script.lg_mute_toggle` (toggles `is_volume_muted` via template). **LG Magic-Remote free POINTER cannot be replicated in HA** — webostv exposes only button/command/select_sound_output, no pointer-move (dx/dy) service; the LG ThinQ app uses the pointer socket directly. Touchpad here = arrow-key nav only.
- **Custom image on a dashboard badge**: upload to HA via `POST /api/image/upload` (multipart field `file`) → returns `{id}` → served at `/api/image/serve/<id>/<WxH>`. Set on a `custom:mushroom-template-badge` via `picture: <url>` (drop icon/content). Used for the LG logo badge. (HA `/api/error_log` returned 404 here; debug logs not readable via API — use `system_log.write` at warning level inside an automation to capture diagnostics that ARE readable via `system_log/list`.)
- **Clone a dashboard**: read source `lovelace/config`, JSON-replace `"/dashboard-favorite/"`→`"/dashboard-test/"` (repoints internal subview navigation so the clone is standalone), save to target url_path. dashboard-test mirrors dashboard-favorite (22 views).
- **Renaming a room (Hallway→Mezzanine)**: change DISPLAY names only, never entity_ids (keeps automations/dashboards working). Devices: `config/device_registry/update {device_id, name_by_user}` (cascades to entity friendly_names). Area: `config/area_registry/update {area_id, name}` (area_id stays `hallway`). Dashboards: case-sensitive JSON replace `"Hallway"`→`"Mezzanine"` (entity_ids use lowercase `hallway`, untouched). An entity whose `original_name` still embeds the old word → set a registry `name` override.
- **Presence-light automation edge-trigger gotcha**: a `state→on` trigger only fires on the off→on EDGE — if a presence sensor is already `on` when the time-window opens, the lights never turn on. Fix (`hallway_presence_lights_on`): ADD a `time` trigger at the window start (e.g. `16:30:00`) + a condition `or(FP300 on, FP1E on)` so an already-present occupant at window-open still triggers it.
- **Aqara FP300 (Matter) presence** has only `number...hold_time` (10s) — **NO sensitivity entity over Matter**. If it holds `on` far longer than hold_time, it's being continuously re-triggered (movement/airflow) — can't be tuned from HA.
- **Imou**: reduced to ONLY the Front camera (`camera.front_cruiser_2_bb0a_camera`) — disabled the 2 Garden devices (`config/device_registry/update disabled_by:"user"`) and removed their dashboard cards. ⚠️ OP1013 quota is still account-wide; disabling in HA may NOT cut the imou_life API polling (it lists all account devices). Real cut = unbind serials at open.imoulife.com.
- **Reading a LocalTuya device's TRUE state / debugging "fan turns off"**: HA `diagnostics` `dps_strings` are **CACHED/stale** and the entity state can be **optimistic** (shown even if the device didn't confirm). To get GROUND TRUTH, query the device directly over LAN with **tinytuya** using the **cloud** key+version: `tinytuya.Device(id, host, key); dev.set_version(float(ver)); dev.status()`. ⚠️ The `local_key` returned by `/api/diagnostics/...` is **REDACTED in the middle** (e.g. `j)>...lf}`) — do NOT compare it to the cloud key and conclude "key mismatch"; get the real key from `tinytuya.Cloud().getdevices()`.
  - **Living Air (Mitsubishi, conn_ms_cn105) "fan suddenly off after temp change" — root cause is the AC HARDWARE, not HA**: proven by the user removing the Tuya WiFi board entirely and the fault persisting on the AC's own remote. It's **load-dependent**: high cooling load (24°C + max fan) trips the AC's protection in 5–15 min (with OR without the board); low load (25°C + low fan) runs 40+ min stable. Consistent with a compressor/capacitor/refrigerant/condenser fault — needs an HVAC tech + the blinking-LED error code; NOT fixable in HA. The CN105 WiFi adapter is low-voltage comms/power only and is electrically isolated from the compressor circuit, so it can't cause a load-dependent trip. Workaround automation `living_air_default_on` (on every off→on, after 2s, set temp 25 + fan level_3 to keep it out of the trip zone). Diagnostic `automation.diag_living_air_off_capture` logs the off-event `context` (user_id/parent_id) via `system_log.write` (warning) + a notification to distinguish command vs device-self-off.

**Session 7 additions:**
- **NFC tags**: list tags via WS `tag/list` → each has `id` (UUID) + `name`. Automate with trigger `{trigger: tag, tag_id: "<id>"}` (the `id` field; `tag_id` in tag/list may be None until first scanned — the UUID still works as the trigger). Created: `nfc_good_night`→`scene.turn_on scene.good_night`; `nfc_morning`→`scene.morning`; `nfc_bedroom_lights_off`→`light.turn_off light.master_bedroom_lights` (group of 9). Tag ids: Good Night `debd6d87-fac8-47f1-b137-e23fa375629a`, Morning `74367d33-c726-4b47-a8b4-b516343a2835`, Bedroom Lights Off `7913d8bc-4a81-4969-a41b-d8db3bf756bc`.
- **`scene.morning`** ("Morning", id `morning`): opens all 5 covers (Foyer L/R curtains, 2 roller shades, ty-wifi curtain) + turns on fans Living/Dining/Mezzanine. Created via `POST /config/scene/config/morning`.
- **FingerBot-safe "turn on" automation**: `morning_fans_on_8am` — time trigger 08:00, condition **all three fans `off`** (AND), then `fan.turn_on` all. Checking off-first is the right way to use FingerBot fans in time/scene automations (a FingerBot click toggles, so only "press" when confirmed off). Fans: Living `fan.living_fan_fingerbot_switch_1` (FingerBot), Dining `fan.fan_dining_socket_1` (real), Mezzanine `fan.hallway_fan_fingerbot_switch_1` (FingerBot).
- **Master Bed Button Zigbee (localtuya scene button) — UNRELIABLE, automations DISABLED**: device `bedroom_button_zigbee` reports the last action on DP1 `switch_type_1` via `select.bedroom_button_zigbee_switch_1` (options Single click/Double click/Long Press). Writes to it do NOT stick (sleepy device — `localtuya.set_dp` & `select.select_option` both ignored), so you CANNOT reset it from HA. Worse, evidence (select history) shows **one physical press makes the select bounce/alternate Single↔Double over ~10s**, firing automations repeatedly → lights flicker. So single/double/long automations on this button are unreliable; the 3 automations (`master_bed_btn_single/double/long`) were created then **turned off**. Real fix = move the button to **Zigbee2MQTT/ZHA** (event-based, clean discrete presses). The OTHER Master-Bedroom button (`event.aqara_wireless_mini_switch_button_2`, Aqara, event entity) IS reliable and already runs the Master AC on/off.
- **Bathroom (Bath Room First Floor) = ONE 2-gang switch**: gang1 `light.bath_room_light_switch_switch_1` = Downlights, gang2 `light.bath_room_light_switch_switch_2` = **Fan** (a light entity but physically the exhaust fan; keep name "Bathroom Fan"). In the lights badge it's ONE tile pointing to the group **`light.bathroom_lights`** (both gangs) — tapping opens the group more-info listing both members, exactly like the Master Bedroom Lights group. Do NOT split into separate tiles. (See memory `ha-dashboard-room-light-group-pattern`.)
- **Mel presence chip** (header chips, both dashboards): content static `"-%"` (the `sensor.mel_s_flip_6_battery_level` no longer exists), icon_color green if `device_tracker.mel_s_phone` home else grey.
- **Full backup taken** at `C:\Users\Ball\Desktop\Claude\ha_backup_<ts>\` (dashboards/automations/scripts/scenes JSON + `restore.py` + README). To restore: `python restore.py all|dashboards|automations|scripts|scenes`. NOTE: does NOT cover entity/device/area registry, integrations, or helpers — pair with a real HA Full Backup for those.


**Session 8 additions:**
- **Home-WiFi fix - Google Nest music stutter.** Router = **Huawei 3-node mesh** (gateway `192.168.3.1`, OUI `88:15:c5`, wired backhaul, band-split SSID `MB Home_2.4GHz`/`_5GHz`). All Nest speakers sat on the congested 2.4GHz with 40+ IoT - ping jitter 120-250ms + 2-100% loss - grouped playback stuttered. **Nest DO support 5GHz** - the old "won't join 5GHz" was a DFS/high channel; set 5GHz to **channel 36 (UNII-1, non-DFS)**, bandwidth **80MHz** (160 bleeds into DFS), security WPA2/mixed (not WPA3-only). Moved Kitchen/Living/Study/Foyer to 5GHz - jitter 3-47ms, 0% loss (offloading also freed 2.4 for the rest). **Diagnose from this wired PC** (no WiFi card): 50-line `System.Net.NetworkInformation.Ping` loop/IP - avg/max/jitter/loss; find Cast speakers + band via `GET http://<ip>:8008/setup/eureka_info?options=detail` (name/ssid/ssdp_udn; new firmware redacts RSSI). Deep detail in memory `home-network-topology`.
- **Removed Music Assistant** (add-on) - Ball doesn't use it; it mirrored EVERY Cast speaker 2-3x via its Google-Cast + AirPlay providers = ALL the duplicate `_2`/`_3`/`+`/`_airplay` ("AirPlay") clutter. HA media_player went 50->11 (1 per real device). MA WS API (`ws://192.168.3.31:8095/ws`) needs its OWN token (rejects the HA LLAT).
- **Config-entry ops (reusable):** reload = service **`homeassistant.reload_config_entry {entry_id}`** (the WS `config_entries/reload` does NOT exist - `unknown_command`) - `reload_entry.py`. Disable = WS **`config_entries/disable {entry_id, disabled_by}`** - `disable_entry.py`. **Remove = REST `DELETE /api/config/config_entries/entry/<id>`** (also NOT a WS command). Disabling only MARKS entities disabled (they still HOLD their entity_ids); REMOVE the entry to free the ids.
- **Cast UUID changes on re-onboarding** (new WiFi / factory reset) - HA keeps the old room-named entity as a dead orphan + makes a live one suffixed `_4` (or raw `nestaudioXXXX` if the device also lost its name). Fix: `config/entity_registry/remove` the orphan, then `config/entity_registry/update {entity_id, new_entity_id, name}` to rename the live one back (do it AFTER the id frees, or another integration grabs it). **Map entity->physical device: match the device's `ssdp_udn` (from eureka_info) to the HA cast `unique_id`** (verified). Real speaker vs virtual group = device **model**: "Google Cast Group" = group (e.g. `google_audio`); "Nest Audio"/"Nest Mini"/"Chromecast" = physical.
- **Audit broadcasts/media after entity edits:** `audit_media_refs.py` scans every automation+script+scene for `media_player.*` and flags refs to entities that no longer exist (ignore service names like `media_player.volume_set`). The 3 MA-era music scripts (`play_searched_music`/`play_ytmusic_playlist`/`stop_music_streaming`) broke (pointed at deleted `*_3`/`nest_group`) — repointed to standard cast media players and replaced Nest Group with Google Audio (`media_player.google_audio`); `script.broadcast_message_to_all_speakers` was already correct (5 clean speakers).
- **Clean Nest media_players (11):** `foyer_speaker`(Nest Audio, .36/2.4), `kitchen_speaker`/`living_room_speaker`/`study_room_speaker`(Nest Mini, 5GHz), `hallway_speaker`(Mezzanine, Nest Mini, 2.4), `google_audio`(Cast Group of all 5) + `dining_room_tv`/`queen_bedroom_tv`/`living_room_tv_lg` + `apple_tv_living_room`. New reusable scripts now in the skill: `reload_entry.py`, `disable_entry.py`, `audit_media_refs.py` (+ session one-offs `inspect_mp.py`/`fix_cast_dupes.py`/`finish_nest_cleanup.py`).


**Session 9 additions:**
- **Good Night Scene Update**: Added the Mezzanine air purifier (`fan.air_purifier_a9_hallway_air_purifier`) in the `off` state.
- **Morning Scene Updates**: Added the Morning scene card to dashboard `/scenes-detail`, and updated `scene.morning` to turn on both A9 purifiers (`fan.air_purifier_a9_living_air_purifier` and `fan.air_purifier_a9_hallway_air_purifier`).
- **Conditional Arrived Home Routine**: Replaced direct scene activation with `script.arrived_home` implementing smart logic:
  - **Always**: Turns ON Dining Fan (`fan.fan_dining_socket_1`), and turns OFF Mezzanine Fan Fingerbot (`fan.hallway_fan_fingerbot_switch_1`) if currently `on`.
  - **Day (06:00-17:00)**: Purifier on 77%. Turns on A/C if Living Room temperature (`sensor.aqara_temp_humidity_sensor_temperature_4`) is > 30°C, otherwise turns on Living Fan Fingerbot (`fan.living_fan_fingerbot_switch_1`) if currently `off`. Lights and curtains remain off.
  - **Night (17:00-06:00)**: Activates `scene.arrived_home` (welcome lights, curtains, A9 purifier) + same A/C or Fan logic.
  - **Triggers redirected**: Updated the dashboard cards, door open automation (`welcome_home_arrived_home`), and switch double press automation (`corridor_mini_switch_double_arrived_home`) to call the script.
- **NFC Tag Automation**: Created `automation.nfc_arrived_home_downstair` which triggers when the "Arrived Home Downstair" tag (`e6435c8a-5621-43f2-b186-e5b232c265f9`) is scanned and runs `script.arrived_home`.
- **Living AC On - Turn Off Fans**: Created `automation.living_ac_on_turn_off_fans` to turn off Dining Fan, and Living/Mezzanine Fingerbot fans (if currently on) when Living A/C turns on, ignoring the Queen Bedroom and Midea Laundry fans.
- **Gate Open - Double-Pulse Fix**: Fixed a race condition in `automation.gate_open_someone_home`. When both phones arrived simultaneously, the automation ran twice in quick succession (under 1 second), pulsing the toggle-based gate switch twice and stopping the gate. Added a 10s delay to the action block to rate-limit/debounce the triggers.
- **Gate Close - Leaving Cycle Delay Fix**: Fixed an issue in `automation.gate_close_both_away`. When leaving, the automation pulsed the gate to close while it was still physically opening, stopping the gate mid-motion. Added a 1-minute start delay to the actions block, ensuring the gate fully opens and stops before the closing pulse is fired, resulting in successful closure on the first try.
- **Motion Sensors Chip & Subview**: Created a new motion sensor count template chip in the View 0 header (placed before the EV chip) on both `dashboard-favorite` and `dashboard-test`. It counts active motion/occupancy/presence sensors (excluding 'not_detect' and 'closed' states). Tapping the chip navigates to a new detailed subview `motion-detail` which lists active motion sensors in a grid of conditional cards (and shows a "No motion detected" fallback message), displays a 48-hour Activity Log (Logbook) for all 34 motion sensors, and categorizes them by area (Main Areas, Rooms & Studies, Outdoor & Laundry, Vibration, and Cameras & Zones). Note: Physical sensors are hardware-driven and read-only in HA, so they cannot be manually cleared from the UI; they reset automatically when motion stops.
- **Water Valves Architecture**:
  - **Devices**: Front Valve Garden (Big Tree `switch.front_valve_garden_switch_1`, Front Bush `switch.front_valve_garden_switch_2`, Battery `sensor.front_valve_garden_battery`), Back Valve Garden (Gardenia `switch.back_valve_garden_switch_1`, Pine `switch.back_valve_garden_switch_2`, Battery `sensor.back_valve_garden_battery`).
  - **Timers**: `timer.valve_big_tree`, `timer.valve_front_bush`, `timer.valve_gardenia`, `timer.valve_pine`.
  - **`automation.garden_valve_timers`**: Failsafe. When any valve turns `on`, if its timer is `idle`, starts a 10m timer. When a valve turns `off`, cancels the timer. On `timer.finished`, turns off the valve. Turns off all valves on Home Assistant start.
  - **`automation.morning_valve_on_7_30_am`** (`morning_valve_0730`): Daily 07:30. Staggered start of timers/valves: Pine 30m, Gardenia 10m, Big Tree 10m, Front Bush 10m.
  - **`automation.evening_valve_on_5_00_pm`** (`evening_valve_1700`): Daily 17:00. Staggered start of timers/valves: Pine 10m, Gardenia 5m, Big Tree 5m (Front Bush is excluded).

Key entities, gateways, and architecture are in **`references/entities.md`**.

## Reference files (read when relevant)
- `references/migration-playbook.md` — Tuya→LocalTuya end-to-end + all gotchas
- `references/dashboards.md` — HACS-via-API, button-card, ULM, card-mod tricks, camera/scene cards
- `references/automations.md` — automation patterns + gate/bedroom/bath/garage + scenes
- `references/aqara-cloud-cameras.md` — Aqara cameras (RTSP/go2rtc), HomeKit, FP2/Aqara-cloud integration + sign algorithm
- `references/entities.md` — device IDs, gateways, light-group architecture
- `references/credentials.md` — 🔐 **the REAL `.env` keys** (Ball's own — keep private; for laptop setup)
- `references/env.example.md` — blank `.env` template (for the shareable/friend version)

**Session 10 additions:**
- **Aqara Alert Scene Sync via Matter**: `switch.alert_on` and `switch.alert_off` (bridged from G5 Pro via Matter) correspond to G5 Pro's **Security Guard Mode** (Armed/Disarmed). If Aqara scenes only "Enable/Disable Automation" instead of Arming/Disarming the Guard Mode, the Matter endpoints never change state. The fix is to change the Aqara scenes to "Change Security Guard Mode" (Arm/Disarm) and add that Guard Mode as a condition in the Aqara automation instead of toggling the automation itself.
- **Tile Card Full-Width in Sections Layout**: Standard container cards like `vertical-stack` ignore `grid_options: {columns: 12}` in the sections grid layout, rendering narrow. To force full width, apply `card_mod` to the `vertical-stack` at `:host` level:
  ```css
  :host {
    position: relative !important;
    grid-column: span 12 / span 12 !important;
    width: 100% !important;
  }
  ```
  This allows placing an absolute-positioned card-mod child button (like Turn Off/Stop stream) in the top-right corner of the Tile Card (`div#root > :nth-child(2) { position: absolute !important; top: 12px !important; right: 12px !important; z-index: 10 !important; }`).
