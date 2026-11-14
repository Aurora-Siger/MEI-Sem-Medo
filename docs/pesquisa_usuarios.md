# Pesquisa: dúvidas recorrentes e entrevistas

## O que já foi levantado (fontes, não entrevistas)
Busca em fontes oficiais e do Sebrae (Portal do Empreendedor/FAQ do gov.br, Perguntão MEI da Receita, materiais de preço do Sebrae) para ver **o que o MEI mais pergunta**. As perguntas frequentes oficiais se concentram em: **formalização** (como abrir, requisitos), **empregado do MEI** (quando contratar, jovem aprendiz), **benefícios** (INSS, seguro-desemprego), **DAS** (valor, atraso), **nota fiscal**, **declaração anual**, **sócio e atividades permitidas**.

**Atenção:** isso mostra *temas*, não *frequência*. Não medimos volume de buscas. Para isso: Google Trends/Search Console, perguntas de grupos de empreendedores (WhatsApp/Instagram) e as entrevistas abaixo.

## Dúvida → onde está na base
| Dúvida do empreendedor | Registro |
|---|---|
| Como abrir MEI / é grátis | B1 |
| Quem pode ser MEI, atividades permitidas | B2 |
| Boletos e cobranças falsas | B3 |
| Posso contratar funcionário? | D1 |
| Posso ter sócio? | D2 |
| Benefícios do INSS | D3 |
| Esqueci de pagar o DAS | D4 |
| Nota fiscal de serviço (NFS-e) | D5 |
| Alvará e licenças | D6 |
| Quanto cobrar / markup / margem / ponto de equilíbrio | P1, P2, P3 + calculadora |
| Limite de R$ 81 mil, DAS, DASN, nota fiscal | M1 a M6 |
| Reforma tributária, Simples, créditos, split | R*, A*, K*, S* |
| Direitos do cliente (troca, garantia, arrependimento) | C* |

## Lacunas conhecidas (ainda sem registro; pesquisar fonte oficial antes de incluir)
Baixa/cancelamento do MEI; MEI e seguro-desemprego; jovem aprendiz; vender para o governo; conta PJ e maquininha; imposto de renda do MEI; como consultar o CNAE; parcelamento do DAS (condições vigentes).

## Roteiro de entrevista (15 min, 5 a 10 empreendedores)
Antes: explique o objetivo, peça autorização para anotar, **não colete nome, CPF, CNPJ nem telefone** (use “Entrevistado 1, 2…”).
1. O que você vende e há quanto tempo? É MEI? Trabalha sozinho(a)?
2. Qual foi a última dúvida de imposto, nota ou preço que você teve? Onde procurou resposta?
3. Quanto tempo levou e você confiou no que achou? Por quê?
4. Como você decide o preço do que vende hoje?
5. Já teve prejuízo ou susto (DAS atrasado, limite, nota)? O que aconteceu?
6. Já ouviu falar da reforma tributária? O que acha que vai mudar?
7. Se tivesse um assistente que responde com fonte, o que perguntaria primeiro?
8. (Mostre o protótipo) Você entendeu a resposta? O que faltou? O que atrapalhou?

## Questionário rápido (opcional)
Qual canal você usa para tirar dúvidas? (WhatsApp, YouTube, contador, Sebrae, site do governo, outro) · Você usa planilha ou caderno para calcular preço? · O que mais te preocupa: preço, imposto, nota fiscal, funcionário, reforma?

## Registro dos resultados
| Entrevistado | Negócio (tipo) | Principal dúvida | Onde procurou | Entendeu o protótipo? | Observações |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
_Preencher depois das entrevistas. Nenhuma entrevista foi feita ainda; este arquivo não contém resultados inventados._

## Como usar o resultado
Perguntas novas viram registros em `data/base.json` (com fonte e data) e casos de teste em `tests/testes.py`; use o teste de usabilidade (`docs/usabilidade.md`) com o mesmo grupo.
