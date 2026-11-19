# Uso de IA

## No desenvolvimento
A equipe contou com o apoio do Claude Code (Anthropic) na execução de algumas etapas do código. Todas as decisões do projeto e a revisão do que foi gerado foram feitas pelo grupo.

## No protótipo
O assistente funciona de dois modos:

1. **Busca na base (padrão, sem IA):** regras em Python escolhem o registro e montam a resposta com um dos dois modelos abaixo.
2. **Assistente de IA (opcional):** um modelo de linguagem (Gemini, Claude ou OpenRouter) recebe a pergunta e só pode consultar as mesmas buscas e calculadoras do projeto.

### Modelos de resposta
| | Modelo A (direto) | Modelo B (estruturado) |
|---|---|---|
| Instrução | Responder só com o registro encontrado, em linguagem simples, citando fonte e data | Igual ao A, separando resumo, explicação, fonte e nível de confiabilidade |
| Limite | Fora da base: "não sei, confirme em [fonte oficial]" | Igual ao A |
| Completos (fonte + data + aviso) | 36/36 | 36/36 |
| Tamanho médio | 557 caracteres | 654 caracteres |

O B deixa a incerteza mais visível (mostra a confiabilidade); o A é mais rápido de ler. Usamos o A como padrão e o B (`--modelo B`) para quem quer saber o quanto confiar.

### Instrução do assistente de IA (`SISTEMA` em `src/agente.py`)
Papel de assistente informativo e não oficial; responder só com o resultado das ferramentas; citar o id do registro (ex.: `[M1]`); nunca fazer contas de cabeça; dizer "não sei" quando a base não cobre; avisar quando o registro é `confirmar` ou o valor é estimativa; não pedir dados pessoais.

## Validação crítica
- **Respostas do modelo × base verificada:** o código só aceita a resposta se ela citar um registro realmente encontrado na base ou usar uma calculadora; caso contrário, a resposta vira "não sei". Citações inventadas são removidas, e a lista de fontes vem da base, nunca do modelo. CPF, CNPJ, e-mail e telefone são removidos antes do envio.
- **Fontes:** cada registro foi conferido na fonte citada. Divergências encontradas: o limite do MEI (algumas páginas citam R$ 130 mil, que é só proposta; usamos R$ 81 mil), a nota fiscal para pessoa física em 2027 e as regras do Simples Híbrido. Esses registros ficaram marcados `confirmar`.
- **Testes:** ao ampliar as perguntas de teste encontramos sinônimos não reconhecidos ("faturar", "cliente comum") e um falso positivo ("receita" casando com receita de bolo), todos corrigidos.
- **Limite conhecido:** o código confere se a fonte citada existe, mas não compara cada número do texto do modelo com o registro. Por isso a instrução exige respostas curtas e com citação, e o modo sem IA continua sendo o padrão.
