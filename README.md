# OMR Processor 2.2.2

mstech OMR é uma ferramenta de reconhecimento óptico de marcas, OMR (Optical Mark Recognition). 
Tem como objetivo a automatização de correções de provas através da captura de imagem de folha de respostas, obtidas por digitalização.
Posteriormente por meio de técnicas de processamento de imagens é feito a correção automática dos gabaritos, gerando um feedback em tela ou 
em uma base de dados com o detalhamento da correção.

## Instalação

A aplicação foi desenvolvida para funcionar server side

É necessário instalar:

- NodeJS;
- MongoDB (https://www.mongodb.org/);
- node-canvas (https://github.com/Automattic/node-canvas);
- Python 2.7 for Windows;
- Microsoft Visual C++ 2010 (or 2012/2013) (https://www.visualstudio.com/pt-br/products/visual-studio-express-vs); 
- GTK 2;	
- Cairo (1.8.6) (http://cairographics.org/download/).

-- Todos os módulos npm através do comando "npm install" na pasta raíz do projeto.

O omr-processor possui dependência do omr-base e do omr-pre-processor, que é uma outra solução responsável por 
equalização de imagem e alguns tratamentos de pre processamento necessários para o futuro processamento no omr-processor  

Após a execução do pre-processamento as informações necessárias para a correção da provas já estarão registradas na base
de dados e o omr-processor já pode ser executado


### Gabaritos

Existe um modelo de gabarito que deve ser seguido para realizar a correção, também deve-se ser registrar as informações 
referentes a esse gabarito, como quantidade de colunas, linhas, questões, alternativas, offsets, etc.

### Imagens

As imagens deverão seguir um padrão:

- Resolução de dpi igualmente proporcional no width e height, exemplo: 200x200, 100x100 e nunca 100x50, 200x100;
- Resolução de dpi entre 100x100 e 300x300;
- Impressão sem conter rasuras como sujeiras ou manchas;
- Impressão sem conter falhas de tintas, desejável qualidade boa à ótima;
- Digitalização sem conter grandes rotações na imagem;