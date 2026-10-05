# Arth Privacy Policy

Effective date: [date]

Arth is a browser extension that explains a word or phrase you select in a ChatGPT conversation. This policy describes what Arth reads, where that goes, and what Arth does not do. It reflects what the extension's code does in version 0.1.0.

## Summary

- Arth reads text from the ChatGPT conversation you are viewing only when you click the Arth button.
- That text is sent to ChatGPT, in your own browser, to produce the explanation. It is not sent to Arth's developer or to anyone else.
- Arth does not store your selections, the text it reads, or the explanations.
- Arth has no analytics, no tracking, no ads and no account.

## Where Arth runs

Arth runs only on `https://chatgpt.com`. It does nothing on any other website.

On chatgpt.com, Arth watches for a text selection so it can show its button next to it. Checking whether a selection is inside a conversation message happens inside your browser; nothing is sent anywhere at that point.

## What Arth reads, and when

When you click the Arth button, and only then, Arth reads the following from the conversation on your screen:

- the text you selected (up to 300 characters);
- the text just before and after it in the same message (up to 300 characters on each side, and a longer excerpt of up to 600 characters on each side);
- up to three neighbouring messages from the same conversation (up to 500 characters each).

At the same moment the extension's code also notes the page's address and title in memory. These are not included in the request and are discarded with it.

Apart from that, Arth reads only the text of conversation messages. It does not read your ChatGPT account details, your list of other conversations, what you type into ChatGPT's message box, passwords, cookies, or anything on other websites.

A conversation can contain whatever you or ChatGPT wrote in it, so the text Arth reads may include personal information if the conversation does.

## Where that text is sent

Arth combines the text above into a single request and submits it to ChatGPT (chatgpt.com, a service operated by OpenAI) to generate the explanation. It does this by opening one extra ChatGPT tab in the background of your own browser and entering the request there, using the ChatGPT session that already exists in your browser (or as a signed-out visitor if you are not signed in).

This means:

- The text does leave the page you are reading: it is submitted to ChatGPT, the same service the conversation came from.
- OpenAI processes that request under its own terms and privacy policy, exactly as if you had typed it into ChatGPT yourself. Arth has no control over how OpenAI handles it.
- When you are signed in to ChatGPT, Arth opens its background tab in ChatGPT's Temporary Chat mode, which ChatGPT does not add to your chat history. When you are signed out, the request is an ordinary signed-out ChatGPT chat. How long OpenAI retains either kind is determined by OpenAI.

Arth sends this text nowhere else. Arth has no server. The extension's code makes no network requests of its own.

## What Arth stores

Arth does not store your selections, the conversation text it reads, the requests it sends, or the explanations it shows. They exist only in memory while a request is in progress and while the explanation card is open.

The only thing Arth saves is a technical value: the browser's internal number for the background tab it opened, so it can reuse that tab. This is kept in the browser's session storage for the extension and is erased when you close the browser. It contains no content and does not identify you.

## Sharing, selling and advertising

Arth's developer receives no data from the extension. Arth does not sell, rent or share your data with anyone. It does not use your data for advertising, profiling or any purpose other than producing the explanation you asked for.

## Analytics and tracking

None. Arth contains no analytics, telemetry, crash reporting or tracking code.

## Your control

- Nothing is read or sent until you click the Arth button.
- Press Escape or click elsewhere to dismiss an explanation; a request still in progress is cancelled.
- You can close the background ChatGPT tab at any time.
- You can disable or remove Arth at any time from `chrome://extensions`. Removing it leaves nothing behind.
- Requests Arth made on your behalf are held by ChatGPT, not by Arth. Use ChatGPT's own settings and OpenAI's privacy controls to manage them.

## Permissions

- **Access to chatgpt.com**: needed to show the button, read the selected passage when you click, and enter the request into ChatGPT in the background tab.
- **Storage**: used only for the tab number described above.

## Children

Arth is not directed at children and does not knowingly collect information from anyone.

## Changes to this policy

If Arth's behaviour changes in a way that affects this policy, this page will be updated and the effective date changed.

## Contact

[Your name or publisher name]
[Your contact email]

Arth is an independent project and is not affiliated with or endorsed by OpenAI.
