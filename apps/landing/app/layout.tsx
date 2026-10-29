import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kebel — orquestador de IA lite, token-eficiente',
  description:
    'Kebel es una versión lite de Karajan Code: TDD-first, revisión cruzada entre IAs y gates de git reales, pensada para quien no tiene suscripciones grandes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
