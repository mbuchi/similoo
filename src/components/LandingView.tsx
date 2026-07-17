import { WelcomeAddressCard, type AddressSearchResult, type WelcomeSignInAction } from '@aireon/shared';
import { t } from '../js/i18n.js';

// Landing view — suite-standard WelcomeAddressCard, shown first; the engine
// (boot() in src/js/main.js) hides it once an address is picked (sets
// `hidden` on #landingView and reveals #comparisonView). The section keeps
// its id and `.landing-view` positioning/background (src/css/landing.css) so
// that show/hide contract keeps working unchanged — only the inner search
// surface changed, from a bespoke form to the shared card.
interface LandingViewProps {
  dark: boolean;
  locale: string;
  /** Liquid Glass appearance level; similoo has glass, so this is forwarded. */
  glassLevel: number;
  /** Same handler the navbar address search drives (dispatches `similoo:search`,
   * which boot()'s engine feeds into handlePick) — immediate load, no confirm step. */
  onSelect: (result: AddressSearchResult) => void;
  /** Sign-in affordance for signed-out visitors; omitted while signed in/loading. */
  signIn?: WelcomeSignInAction;
}

export default function LandingView({ dark, locale, glassLevel, onSelect, signIn }: LandingViewProps) {
  return (
    <section id="landingView" className="landing-view">
      <WelcomeAddressCard
        appName="similoo"
        appId="similoo"
        title={t('landing.title')}
        description={t('landing.subtitle')}
        dark={dark}
        glassLevel={glassLevel}
        locale={locale}
        searchLabels={{
          placeholder: t('landing.search_placeholder'),
          loading: t('nav.search_loading'),
          noResults: t('nav.search_no_results'),
          clear: t('nav.clear_search'),
          resultsCount: (n) => t('nav.search_results_count', { count: n }),
        }}
        onSelect={onSelect}
        signIn={signIn}
      />
    </section>
  );
}
