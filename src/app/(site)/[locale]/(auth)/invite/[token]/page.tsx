import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AcceptInvite, InviteSignup } from "@/components/staff/invite-forms";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { initLocale } from "@/i18n/server";
import { getSessionUser } from "@/lib/auth/session";
import { loadInvitation } from "@/lib/merchants/staff";

type Params = Promise<{ locale: string; token: string }>;

const FSI = String.fromCodePoint(0x2068);
const PDI = String.fromCodePoint(0x2069);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  // The URL is a bearer secret: never indexed, and never sent to another site as a referrer.
  // ("same-origin", not "no-referrer": the latter makes browsers send Origin: null on form
  // posts, which the CSRF origin checks rightly refuse.)
  return {
    title: t("pageTitle"),
    robots: { index: false, follow: false },
    referrer: "same-origin",
  };
}

export default async function InvitePage({ params }: { params: Params }) {
  const locale = await initLocale(params);
  const { token } = await params;
  const t = await getTranslations("invite");
  const invitation = await loadInvitation(token);

  if (invitation.state !== "valid") {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold">{t("invalid.title")}</h1>
        <p className="text-muted-foreground">{t("invalid.body")}</p>
        <Button asChild variant="outline" className="self-start">
          <Link href="/">{t("invalid.home")}</Link>
        </Button>
      </div>
    );
  }

  const user = await getSessionUser();
  const matches = user && (user.email ?? "").toLowerCase() === invitation.email.toLowerCase();
  // First-strong isolate: an Arabic shop name inside a French sentence can't drag punctuation.
  const shop = `${FSI}${invitation.shopName}${PDI}`;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold">{t("title", { shop })}</h1>
        <p className="text-muted-foreground">{t("body", { shop })}</p>
      </header>
      {!user ? (
        <InviteSignup token={token} email={invitation.email} />
      ) : matches ? (
        <AcceptInvite token={token} shopName={shop} />
      ) : (
        <div className="flex flex-col gap-4 rounded-xl border p-5">
          <p>
            {t.rich("wrongAccount", {
              current: user.email ?? "",
              email: invitation.email,
              b: (chunks) => (
                <bdi dir="ltr" className="font-semibold">
                  {chunks}
                </bdi>
              ),
            })}
          </p>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="next" value={`/invite/${token}`} />
            <Button type="submit" variant="outline">
              {t("switch")}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
