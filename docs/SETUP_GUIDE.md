# Ship Hungry Snaily Math to the App Store (from a Windows PC)

Apple only builds iOS apps on a Mac. This project uses a **free Mac in GitHub's cloud** to build, sign and upload the app. You just click buttons in your browser. Plan on about an hour the first time.

You need:
- Your **Apple Developer account** (BoomLabs, already set up).
- A free **GitHub account** (github.com).
- The file `CERTIFICATE_PRIVATE_KEY.txt` that came with this project. It's a secret. Don't commit it, email it or share it.

---

## Step 1: Fill in your support email (2 minutes)

Before Apple accepts the app, parents need a way to contact you.

1. Open `www/app/config.js` and replace `SET-YOUR-SUPPORT-EMAIL` with your support email.
2. Open `site/privacy.html` and `site/index.html` and replace `SUPPORT-EMAIL` (and `EFFECTIVE-DATE`) the same way.

The build stops with a clear error if you skip this.

## Step 2: Put the project on GitHub (10 minutes)

1. On github.com, click **New repository**. Name it `hungry-snaily-math` and choose **Private**. Don't add a README.
2. On the new repo page, click **uploading an existing file**. Drag in **everything inside** the `hungry-snaily-math` folder, including the hidden `.github` folder. Then click **Commit changes**.
   - Windows hides folders that start with a dot. In File Explorer, choose **View › Show › Hidden items**.
   - Or use **GitHub Desktop** (desktop.github.com). Add the folder as a repository and click **Publish**.
3. Check that the repo shows `.github/workflows/ios-testflight.yml`.

## Step 3: Register the app with Apple (10 minutes)

1. Go to **developer.apple.com › Account › Certificates, IDs & Profiles › Identifiers**. Click **+** and choose **App IDs › App**.
   - Description: `Hungry Snaily Math`
   - Bundle ID: **Explicit**, `com.boomlabs.hungrysnaily`
   - Capabilities: leave them all off. Click **Continue › Register**.
2. Go to **appstoreconnect.apple.com › Apps › + › New App**.
   - Platforms: **iOS**
   - Name: `Hungry Snaily Math`. If the name is taken, try a variant such as "Hungry Snaily: Math Stories".
   - Primary language: English (U.S.)
   - Bundle ID: pick `com.boomlabs.hungrysnaily`
   - SKU: `hungrysnaily001`
   - User access: Full access

## Step 4: Create an App Store Connect API key (5 minutes)

This key lets the cloud Mac sign and upload for you.

1. In App Store Connect, go to **Users and Access › Integrations › App Store Connect API › Team Keys** and click **+**.
2. Name: `GitHub build`. Access: **Admin**, which it needs to create the signing certificate.
3. Click **Download API Key**. You get a file named like `AuthKey_ABC123XYZ.p8`. You can only download it once, so keep it safe.
4. Write down the **Key ID** (shown in the key's row) and the **Issuer ID** (shown above the table).

## Step 5: Add 4 secrets to GitHub (5 minutes)

In your GitHub repo, go to **Settings › Secrets and variables › Actions › New repository secret**. Add these 4 secrets:

| Name | Value |
|---|---|
| `ASC_KEY_ID` | The Key ID from Step 4 |
| `ASC_ISSUER_ID` | The Issuer ID from Step 4 |
| `ASC_KEY_P8` | Open the `.p8` file in Notepad and paste **all** of it, including the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines |
| `CERTIFICATE_PRIVATE_KEY` | Open `CERTIFICATE_PRIVATE_KEY.txt` in Notepad and paste **all** of it |

After you save them, move `CERTIFICATE_PRIVATE_KEY.txt` and the `.p8` file somewhere safe, such as a password manager. GitHub keeps encrypted copies.

## Step 6: Build and upload (about 15 minutes, all automatic)

1. In GitHub, open **Actions › iOS build + TestFlight › Run workflow**. Keep version `1.0.0` and click **Run workflow**. A quick browser test of the game runs first (about 2 minutes), then the Mac build.
2. Wait for the green tick. If a step turns red, click it to read the error. The common ones are listed under "If something fails" below.
3. About 10 to 30 minutes later, the build appears in App Store Connect under **TestFlight**. Apple emails you when processing is done.

Each later run gets a new build number automatically. To release version 1.0.1, run the workflow again and type `1.0.1`.

## Step 7: Test on real devices with TestFlight

1. In App Store Connect, open **TestFlight › Internal Testing** and click **+** to create a group. Add yourself and 2 or 3 parents. They need to be users on your App Store Connect team.
2. Testers install the **TestFlight** app from the App Store and accept the invite.
3. Check on an iPhone and an iPad:
   - Both landscape directions.
   - **Airplane mode:** everything still works.
   - **Silent switch on:** the app makes no sound. This is expected, because the app is set to respect it.
   - Snaily's voice. For a nicer voice, download an enhanced English voice in **Settings › Accessibility › Spoken Content › Voices**.
   - The parent gate: hold the gear for 2s, then answer the multiplication question.
   - The break reminder.
   - Reset progress.
   - The Reduce Motion setting.

## Step 8: Screenshots

1. Open **Actions › Store screenshots › Run workflow**.
2. When it finishes, open the run and download **store-screenshots** at the bottom. It has 5 iPhone 6.9″ shots (2868×1320) and 5 iPad 13″ shots (2752×2064), all in the real Fredoka font.
3. You can also take screenshots on a TestFlight device. Press the side button and volume up at the same time.

## Step 9: Host the privacy policy and support page

Apple requires a public URL for each. The simplest free option:

1. Create a second, **public** GitHub repo, for example `snaily-site`. Upload `site/index.html` and `site/privacy.html`.
2. In that repo, go to **Settings › Pages**. Under Source, pick **Deploy from a branch**, then choose `main` and `/ (root)`, and click **Save**.
3. After about a minute your URLs are:
   - Support: `https://YOUR-NAME.github.io/snaily-site/`
   - Privacy: `https://YOUR-NAME.github.io/snaily-site/privacy.html`

## Step 10: Fill in the store listing and submit

Copy the text from `docs/STORE_LISTING.md` into App Store Connect, then:

1. **App Privacy:** choose **Data Not Collected**.
2. **Age Rating:** answer "None" or "No" to everything. Under Kids, choose **Made for Kids › Ages 6–8**.
3. **Pricing:** Free. **Availability:** all countries you want.
4. Under **Build**, pick the TestFlight build. Paste the App Review notes, then click **Submit for Review**.

---

## If something fails

| Error | Fix |
|---|---|
| **web-tests** job fails | The browser test found a problem in the game. Open the job log: every check is listed, and failed ones are marked ✗. Send it to Claude to fix. |
| `Secret for … is not set` | Add the missing secret (Step 5). Names must match exactly. |
| `Set supportEmail in www/app/config.js` | Do Step 1. |
| Signing step: `Cannot find bundle identifier` | Register the App ID (Step 3.1) with exactly `com.boomlabs.hungrysnaily`. |
| Signing step: `403` or `not allowed` | The API key needs **Admin** access (Step 4). |
| `maximum number of certificates` | In developer.apple.com › Certificates, revoke an old **Apple Distribution** certificate you no longer use, then run again. |
| Upload: `bundle version must be higher` | Just run the workflow again. The build number goes up each run. |
| Upload: `SDK version` error | Apple raised the required Xcode. Change `runs-on: macos-26` in `.github/workflows/ios-testflight.yml` to the newest `macos-NN` image. |

## Updating the game later

The designer's prototypes live in `design/prototype/`. When they change:

1. Replace the two `.dc.html` files there.
2. Run `python3 scripts/patch-prototypes.py`. It rebuilds `www/story.html` and `www/garden.html`. If a patch no longer fits, it stops and names the line.
3. Commit, then run the workflow with a higher version.
