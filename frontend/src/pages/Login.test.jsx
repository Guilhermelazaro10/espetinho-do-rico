import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';

vi.mock('../ui/toast', () => ({
  notificar: { sucesso: vi.fn(), erro: vi.fn(), brasa: vi.fn(), info: vi.fn() },
  ToasterGlobal: () => null,
}));
vi.mock('../lib/api', () => ({ api: { auth: { login: vi.fn() } } }));

import { api } from '../lib/api';
import { notificar } from '../ui/toast';

function digitarPin(pin) {
  for (const d of pin) fireEvent.click(screen.getByRole('button', { name: d }));
  fireEvent.click(screen.getByRole('button', { name: /entrar/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Login — aviso de PIN curto do gerente', () => {
  it('gerente com PIN de 4 dígitos entra e é avisado para trocar', async () => {
    api.auth.login.mockResolvedValue({
      token: 't', usuario: { id: 1, nome: 'Rico', papel: 'GERENTE' }, avisoPinCurto: true,
    });
    const aoEntrar = vi.fn();
    render(<Login aoEntrar={aoEntrar} />);
    digitarPin('1234');

    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    expect(notificar.brasa).toHaveBeenCalledWith(expect.stringMatching(/PIN/), expect.stringMatching(/6 d/));
  });

  it('sem aviso quando o servidor não pede', async () => {
    api.auth.login.mockResolvedValue({ token: 't', usuario: { id: 1, nome: 'Rico', papel: 'GERENTE' } });
    const aoEntrar = vi.fn();
    render(<Login aoEntrar={aoEntrar} />);
    digitarPin('123456');

    await waitFor(() => expect(aoEntrar).toHaveBeenCalled());
    expect(notificar.brasa).not.toHaveBeenCalled();
  });
});
