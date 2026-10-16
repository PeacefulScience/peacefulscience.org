from dotenv import load_dotenv
from .bottlim import PlimTemplate
from bs4 import BeautifulSoup as bs
from mailchimp3 import MailChimp
import requests
from datetime import datetime
from markdown2 import Markdown
from ..document import Document
import json
import sys
import re
import datetime
import iso8601
import markdown2
import os
import pytz

load_dotenv()


TEMPLATE = open("code/newsletter.plim").read()


def mjml2html(mjml):
    auth = (os.environ["MJML_API_ID"], os.environ["MJML_SECRET_KEY"])
    payload = {"mjml": mjml}
    r = requests.post("https://api.mjml.io/v1/render", auth=auth, json=payload).json()
    # for i in r: print(i)
    if "html" not in r:
        raise RuntimeError(r["message"])
    else:
        return r["html"]


def plim_mjml(plm, *args, **kwargs):
    pm = PlimTemplate(plm)
    pm = pm.render(*args, **kwargs)

    with open("newsletter.mjml", "w") as F:
        print(pm, file=F)

    soup = bs(pm, features="lxml")

    soup = soup.html.body.mjml
    pm = soup.prettify()

    return mjml2html(pm)


def _cdn_image_url(url):
    """Prefer CloudFront for Netlify Image CDN URLs (Mailchimp opens)."""
    if not url:
        return url
    return url.replace(
        "https://peacefulscience.org/.netlify/images",
        "https://cdn.peacefulscience.org/.netlify/images",
        1,
    )


def newsletter_data(doc):
    pages = doc.frontmatter.get("pages", [])
    _INDEX = json.load(open("public/algolia.json"))
    PAGES = []

    for n, P in enumerate(pages):
        P = re.sub("/$", "", P) + "/"
        for p in _INDEX:
            if p["relpermalink"] == P:
                p = dict(p)
                if p.get("image"):
                    p["image"] = _cdn_image_url(p["image"])
                PAGES.append(p)

    DATE = iso8601.parse_date(str(doc.frontmatter["date"]))
    TITLE = doc.frontmatter["title"]

    HEADING = "Articles"
    for layer in doc.frontmatter.get("layers", []):
        if layer["type"] == "pages":
            HEADING = layer["heading"]

    MARKDOWN = doc.text
    HTML = markdown2.markdown(MARKDOWN)

    return {
        "articles": PAGES,
        "date": DATE,
        "title": TITLE,
        "heading": HEADING,
        "markdown": MARKDOWN,
        "HTML": HTML,
        "description": doc["description"],
        "links": [],
    }


mc = MailChimp(mc_api=os.environ["MAILCHIMP_API"], mc_user=os.environ["MAILCHIMP_USER"])


def create_newsletter(DATA, HTML):
    mc_list = os.environ["MAILCHIMP_AUDIENCE"]

    C = mc.campaigns.create(
        {
            "name": DATA["title"],
            "type": "regular",
            "list_id": mc_list,
            "recipients": {"list_id": mc_list},
            "content_type": "template",
            "settings": {
                "subject_line": DATA["title"],
                "preview_text": DATA["description"],
                "from_name": "Peaceful Science",
                "reply_to": "info@peacefulscience.org",
                "inline_css": True,
                "use_conversation": True,
                "timewarp": True,
            },
            "tracking": {
                "text_clicks": True,
            },
        }
    )

    campaign_id = C["id"]

    return campaign_id


def update_newsletter(DATA, HTML, ID):
    mc.campaigns.content.update(ID, {"message": "Newsletter", "html": HTML})

    mc.campaigns.actions.test(
        ID,
        {
            "send_type": "html",
            "test_emails": os.environ["MAILCHIMP_TEST_EMAILS"].split(";"),
        },
    )


def send_newsletter(DATA):
    with open("newsletter_id.txt") as F:
        ID = F.read()

    SEND_TIME = DATA["date"] + datetime.timedelta(hours=16)  # 10:00 AM CDT
    SEND_TIME = SEND_TIME
    print(SEND_TIME)


#  mc.campaigns.actions.schedule(ID, {
#    "schedule_time": SEND_TIME,
#  })


def main(args=sys.argv[1:]):
    D = Document(args[0])
    DATA = newsletter_data(D)

    # if "SEND" in args:
    #     send_newsletter(DATA)
    #     return

    TEMPLATE = open("code/newsletter.plim").read()
    HTML = plim_mjml(TEMPLATE, **DATA)
    with open("newsletter.html", "w") as F:
        print(HTML, file=F)

    D.frontmatter["mailchimp"] = D.frontmatter.get("mailchimp", {})
    if "campaign_id" in D.frontmatter["mailchimp"]:
        ID = D.frontmatter["mailchimp"]["campaign_id"]
        print(f"Updating campaign {ID}")

    else:
        ID = create_newsletter(DATA, HTML)
        print(f"Creating campaign {ID}")
        D.frontmatter["mailchimp"]["campaign_id"] = ID
        with open(D.filename, "w") as f:
            D.dump(f)

    update_newsletter(DATA, HTML, ID)


if __name__ == "__main__":
    main()
