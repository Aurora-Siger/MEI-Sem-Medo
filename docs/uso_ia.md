# Uso de IA

## Onde a IA foi usada
- **Claude (Anthropic)**: ideação do tema, pesquisa de fontes na web, rascunho da base de conhecimento, do `sistema.py` e dos testes.
- **Verificação humana**: cada registro cita a fonte; os campos `confianca` e `verificado` mostram o que precisa ser reconfirmado. O grupo deve revisar os registros marcados `confirmar` antes da entrega.
- **Em tempo de execução o sistema não chama nenhuma IA**: responde só com a base, o que evita invenção de respostas.

## Divergências encontradas na pesquisa
- Limite do MEI: a maioria das fontes diz R$ 81 mil; uma página citou R$ 130 mil (proposta, não vigente). Base usa R$ 81 mil.
- Nota fiscal para pessoa física em 2027: fontes divergem; registro R7 marcado `confirmar`.
- Simples Híbrido: prazo de opção (30/09/2026) já passou e a aplicação ao MEI não é clara; registro R5 marcado `confirmar`.

## Modelos de prompt / resposta
**Modelo A (direto)**: resposta curta + fonte + aviso + tópicos relacionados. Para quem quer rapidez.
**Modelo B (estruturado)**: resumo, explicação, fonte, nível de confiabilidade + aviso + relacionados. Para quem quer entender o quanto confiar.

Se for acoplado um LLM, o prompt-base seria: "Responda apenas com o registro fornecido, em linguagem simples para um microempreendedor. Cite a fonte. Se o registro não cobrir a pergunta, diga que não sabe." Comparação: o modelo B deixa a incerteza mais visível; o A é mais rápido de ler.

## Comparação objetiva dos modelos (tests/testes.py)
Em 26 perguntas respondidas: A e B tiveram 26/26 respostas com fonte, data e aviso corretos. O tamanho médio foi 519 caracteres (A) e 616 (B). **Conclusão:** os dois são consistentes; o B é mais claro para quem precisa decidir o quanto confiar (mostra "Confiabilidade"), o A é mais curto. Recomendado: B para registros `confirmar`, A para o restante. Limitação: a comparação mede completude, não a opinião de leitores.

## Validação crítica
- Os testes foram escritos junto com o código e, ao ampliar de 18 para 24 perguntas, acharam 2 falhas reais (sinônimos "faturar" e "cliente comum"), corrigidas na base, e um falso positivo criado por mim ("receita"), revertido.
- A IA não substitui a conferência das fontes: o grupo deve abrir cada URL da base antes de entregar.

## Segunda etapa: frontend, base ampliada e calculadoras
- A IA (Claude) escreveu o frontend, os 16 registros novos (split payment, Simples, créditos) e as calculadoras, a partir de pesquisa web em fontes secundárias (blogs contábeis, CRC-SP) e das leis (LC 123/2006 e LC 214/2025). As tabelas do Simples foram escritas de memória a partir da LC 123 e **precisam ser conferidas pelo grupo contra o texto no Planalto** antes da entrega.
- Pesquisa mostrou divergências: número e nomes das modalidades de split (2, 3 ou 4) e regras de crédito do Simples; esses registros ficaram `confirmar`.
- O simulador de créditos usa alíquota e parcela do DAS **estimadas e editáveis**; não representa regra oficial.
- Validação: teste de paridade garante que o site e o Python respondem igual; verificação visual em tela de celular.
