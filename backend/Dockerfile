FROM python:3.12

COPY . /app/backend
WORKDIR /app

# RUN apk add --no-cache gcc musl-dev linux-headers
RUN pip install -r backend/requirements.txt
EXPOSE 3000 2500

RUN \
  apt-get update && \
  apt-get install -y ca-certificates && \
  apt-get clean && \
  update-ca-certificates

RUN pip install certifi
ENV REQUESTS_CA_BUNDLE=/usr/local/lib/python3.12/site-packages/certifi/cacert.pem

CMD ["python", "-m", "backend.run"]