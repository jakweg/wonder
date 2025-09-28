# Running the project

Everything is run inside docker containers, you need to have docker-compose installed

#### Steps to run:

1. Clone this repository

   ```bash
   git clone https://github.com/JakubekWeg/wonder --depth 1
   ```

2. Copy example configuration

   ```bash
   cp ./example.env .env
   ```

3. Now, please review configuration inside `.env` and make your changes
4. Once you're ready run use to start the project
   ```bash
   docker-compose up --build
   ```
