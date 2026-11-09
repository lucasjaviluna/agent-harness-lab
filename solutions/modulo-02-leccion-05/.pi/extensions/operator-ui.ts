/**
 * Módulo 2 · Lección 5 (global 10): primera personalización de la TUI de Pi.
 * La presentación es OPT-IN: no reemplaza la TUI nativa al iniciar.
 * No persiste prompts ni ejecuta herramientas; sólo estadísticas no sensibles.
 */
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import {
  createOperatorState,
  fitAscii,
  operatorStatus,
  operatorWidget,
  recordOperatorEvent,
} from '../ui/operator-state.mjs';

export default function operatorUi(pi: ExtensionAPI) {
  const state = createOperatorState();

  function refresh(ctx: ExtensionContext) {
    // hasUI también es true en RPC: estas APIs son exclusivas de TUI.
    if (ctx.mode !== 'tui' || !state.enabled) return;
    ctx.ui.setStatus('agent-lab', operatorStatus(state));
    const options = state.placement === 'belowEditor' ? { placement: 'belowEditor' } : undefined;
    ctx.ui.setWidget('agent-lab-dashboard', operatorWidget(state), options);
  }

  function enable(ctx: ExtensionContext) {
    if (ctx.mode !== 'tui') return;
    state.enabled = true;
    ctx.ui.setHeader((_tui, theme) => ({
      render(width: number) {
        // El encabezado usa sólo texto corto de nuestra extensión.
        return [theme.fg('accent', fitAscii('Agent Harness Lab - Consola del operador', width))];
      },
      invalidate() {},
    }));
    ctx.ui.setTitle('Agent Harness Lab | Pi');
    refresh(ctx);
  }

  function disable(ctx: ExtensionContext) {
    state.enabled = false;
    state.footer = false;
    if (ctx.mode !== 'tui') return;
    ctx.ui.setHeader(undefined);
    ctx.ui.setFooter(undefined);
    ctx.ui.setStatus('agent-lab', undefined);
    ctx.ui.setWidget('agent-lab-dashboard', undefined);
    // No conocemos el título anterior del usuario: restablecemos un título genérico.
    ctx.ui.setTitle('Pi');
  }

  pi.on('session_start', (_event, ctx) => {
    recordOperatorEvent(state, { type: 'session_start' });
    refresh(ctx);
  });
  pi.on('agent_start', (_event, ctx) => {
    recordOperatorEvent(state, { type: 'agent_start' });
    refresh(ctx);
  });
  pi.on('tool_execution_end', (event, ctx) => {
    recordOperatorEvent(state, { type: 'tool_execution_end', isError: event.isError });
    refresh(ctx);
  });
  pi.on('agent_settled', (_event, ctx) => {
    recordOperatorEvent(state, { type: 'agent_settled' });
    refresh(ctx);
  });
  pi.on('session_shutdown', (_event, ctx) => disable(ctx));

  pi.registerCommand('lab-ui', {
    description: 'Activar, desactivar o reiniciar: /lab-ui on|off|status|reset',
    handler: async (args, ctx) => {
      if (ctx.mode !== 'tui') {
        // La ausencia de TUI es una condición esperada en print/JSON/RPC.
        return;
      }
      const action = args.trim().toLowerCase();
      if (action === 'reset') {
        recordOperatorEvent(state, { type: 'session_start' });
        refresh(ctx);
        ctx.ui.notify('Contadores reiniciados', 'info');
      } else if (action === 'on') { enable(ctx); ctx.ui.notify('Interfaz Agent Lab activada', 'info'); }
      else if (action === 'off') { disable(ctx); ctx.ui.notify('Interfaz nativa restaurada', 'info'); }
      else if (action === 'status' || action === '') ctx.ui.notify(operatorStatus(state), 'info');
      else ctx.ui.notify('Uso: /lab-ui on|off|status|reset', 'warning');
    },
  });

  pi.registerCommand('lab-widget', {
    description: 'Posición del widget: /lab-widget above|below',
    handler: async (args, ctx) => {
      if (ctx.mode !== 'tui') return;
      const where = args.trim().toLowerCase();
      if (where !== 'above' && where !== 'below') {
        ctx.ui.notify('Uso: /lab-widget above|below', 'warning');
        return;
      }
      state.placement = where === 'below' ? 'belowEditor' : 'aboveEditor';
      refresh(ctx);
      ctx.ui.notify(`Widget: ${where === 'below' ? 'debajo' : 'encima'} del editor`, 'info');
    },
  });

  pi.registerCommand('lab-footer', {
    description: 'Footer alternativo (reemplaza al nativo): /lab-footer on|off',
    handler: async (args, ctx) => {
      if (ctx.mode !== 'tui') return;
      const mode = args.trim().toLowerCase();
      if (mode === 'off') {
        state.footer = false;
        ctx.ui.setFooter(undefined);
        return;
      }
      if (mode !== 'on') {
        ctx.ui.notify('Uso: /lab-footer on|off', 'warning');
        return;
      }
      state.footer = true;
      ctx.ui.setFooter((_tui, _theme, footerData) => ({
        render(width: number) {
          const branch = footerData.getGitBranch?.();
          const message = `${operatorStatus(state)}${branch ? ` | git: ${branch}` : ''}`;
          return [fitAscii(message, width)];
        },
        invalidate() {},
      }));
      ctx.ui.notify('Footer alternativo activado (se ocultan datos del footer original)', 'warning');
    },
  });

  pi.registerCommand('lab-panel', {
    description: 'Panel interactivo para ver estado y configurar el widget',
    handler: async (_args, ctx) => {
      if (ctx.mode !== 'tui') return;
      const option = await ctx.ui.select('Agent Lab - Panel del operador', [
        'Ver resumen', 'Cambiar posición del widget', 'Cancelar',
      ]);
      if (option === 'Cambiar posición del widget') {
        const choice = await ctx.ui.select('Ubicación del widget', ['Encima del editor', 'Debajo del editor', 'Cancelar']);
        if (choice === 'Encima del editor' || choice === 'Debajo del editor') {
          state.placement = choice === 'Debajo del editor' ? 'belowEditor' : 'aboveEditor';
          refresh(ctx);
        }
      } else if (option === 'Ver resumen') {
        // Un componente real con render e input, sin una segunda TUI externa.
        await ctx.ui.custom((_tui, _theme, keybindings, done) => ({
          render(width: number) {
            return [
              fitAscii('=== AGENT HARNESS LAB ===', width),
              fitAscii(operatorStatus(state), width),
              fitAscii('Enter: cerrar | Esc: cancelar', width),
            ];
          },
          handleInput(data: string) {
            if (keybindings.matches(data, 'tui.select.confirm')) done(true);
            else if (keybindings.matches(data, 'tui.select.cancel')) done(false);
          },
          invalidate() {},
        }));
      }
    },
  });
}
