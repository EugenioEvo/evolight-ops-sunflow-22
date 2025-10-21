-- Inserir insumos básicos para manutenção solar com categorias corretas
INSERT INTO insumos (nome, categoria, quantidade, unidade, estoque_minimo, estoque_critico) 
SELECT * FROM (VALUES
  ('Cabo Solar 4mm²', 'cabos_conectores', 100, 'metros', 50, 20),
  ('Cabo Solar 6mm²', 'cabos_conectores', 80, 'metros', 40, 15),
  ('MC4 Macho', 'cabos_conectores', 50, 'unidade', 20, 10),
  ('MC4 Fêmea', 'cabos_conectores', 50, 'unidade', 20, 10),
  ('Disjuntor 32A', 'componentes_eletricos', 10, 'unidade', 5, 2),
  ('Disjuntor 40A', 'componentes_eletricos', 10, 'unidade', 5, 2),
  ('Fusível 15A', 'componentes_eletricos', 30, 'unidade', 10, 5),
  ('Fusível 20A', 'componentes_eletricos', 30, 'unidade', 10, 5),
  ('Silicone Neutro', 'manutencao', 20, 'unidade', 5, 2),
  ('Fita Isolante', 'componentes_eletricos', 40, 'unidade', 15, 5),
  ('Abraçadeira Plástica 200mm', 'manutencao', 100, 'unidade', 40, 15),
  ('Eletroduto 20mm', 'componentes_eletricos', 50, 'metros', 20, 10),
  ('String Box 2 Entradas', 'componentes_eletricos', 8, 'unidade', 3, 1),
  ('Multímetro Digital', 'equipamentos_medicao', 5, 'unidade', 2, 1),
  ('Alicate Amperímetro', 'equipamentos_medicao', 5, 'unidade', 2, 1),
  ('Chave Phillips', 'ferramentas', 10, 'unidade', 4, 2),
  ('Chave de Fenda', 'ferramentas', 10, 'unidade', 4, 2),
  ('Alicate de Crimpagem MC4', 'ferramentas', 5, 'unidade', 2, 1)
) AS v(nome, categoria, quantidade, unidade, estoque_minimo, estoque_critico)
WHERE NOT EXISTS (
  SELECT 1 FROM insumos WHERE insumos.nome = v.nome
);