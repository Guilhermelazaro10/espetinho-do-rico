import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Truck, Zap } from 'lucide-react';
import Botao from './Botao';
import Campo from './Campo';
import Segmentado from './Segmentado';
import Selo from './Selo';
import Sheet from './Sheet';

// jsdom não tem ResizeObserver; o Segmentado só precisa que ele exista.
globalThis.ResizeObserver ??= class {
  observe() {}
  disconnect() {}
};

describe('Botao', () => {
  it('carregando desabilita e marca aria-busy', () => {
    const clique = vi.fn();
    render(<Botao carregando onClick={clique}>Enviar</Botao>);
    const botao = screen.getByRole('button', { name: 'Enviar' });
    expect(botao.disabled).toBe(true);
    expect(botao.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(botao);
    expect(clique).not.toHaveBeenCalled();
  });

  it('é type="button" por padrão (não envia formulário sem querer)', () => {
    render(<Botao>Ok</Botao>);
    expect(screen.getByRole('button').getAttribute('type')).toBe('button');
  });
});

describe('Campo', () => {
  it('liga rótulo, erro e repassa autoComplete/inputMode', () => {
    render(<Campo rotulo="Telefone" erro="Informe o telefone" autoComplete="tel" inputMode="tel" type="tel" />);
    const input = screen.getByLabelText('Telefone');
    expect(input.getAttribute('autocomplete')).toBe('tel');
    expect(input.getAttribute('inputmode')).toBe('tel');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const erro = screen.getByText('Informe o telefone');
    expect(input.getAttribute('aria-describedby')).toContain(erro.id);
  });

  it('select usa as opções filhas', () => {
    render(
      <Campo como="select" rotulo="Bairro" defaultValue="b">
        <option value="a">Centro</option>
        <option value="b">Juazeiro</option>
      </Campo>
    );
    expect(screen.getByLabelText('Bairro').value).toBe('b');
  });
});

describe('Segmentado', () => {
  it('marca o ativo com aria-pressed e troca ao clicar', () => {
    function Demo() {
      const [v, setV] = useState('rapida');
      return (
        <Segmentado
          rotulo="Tipo de venda"
          valor={v}
          aoMudar={setV}
          opcoes={[
            { valor: 'rapida', rotulo: 'Venda rápida', icone: Zap },
            { valor: 'delivery', rotulo: 'Delivery', icone: Truck, contador: 3 },
          ]}
        />
      );
    }
    render(<Demo />);
    const delivery = screen.getByRole('button', { name: /Delivery/ });
    expect(delivery.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(delivery);
    expect(delivery.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Venda rápida/ }).getAttribute('aria-pressed')).toBe('false');
  });
});

describe('Selo', () => {
  it('mostra o texto como veio (sentence case, sem caixa alta)', () => {
    render(<Selo tom="ok">Pago</Selo>);
    expect(screen.getByText('Pago').classList.contains('uppercase')).toBe(false);
  });
});

describe('Sheet', () => {
  function Demo() {
    const [aberto, setAberto] = useState(false);
    return (
      <>
        <button onClick={() => setAberto(true)}>Abrir sacola</button>
        <Sheet aberto={aberto} aoFechar={() => setAberto(false)} titulo="Sua sacola">
          <input aria-label="Observação" />
        </Sheet>
      </>
    );
  }

  it('abre como diálogo modal, foca o painel, fecha no Esc e devolve o foco', () => {
    render(<Demo />);
    const abrir = screen.getByRole('button', { name: 'Abrir sacola' });
    abrir.focus();
    fireEvent.click(abrir);

    const dialogo = screen.getByRole('dialog', { name: 'Sua sacola' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialogo); // o painel, nunca um controle destrutivo

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(abrir);
  });

  it('o botão Fechar fecha', () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir sacola' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
