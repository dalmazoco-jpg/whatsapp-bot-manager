#!/bin/bash

echo "🚀 Deploy iniciado..."

git add .
git commit -m "deploy automático"
git push

gcloud run deploy crm-whatsapp-saas \
  --source . \
  --region us-central1 \
  --project robo-atendimento-dalmazo \
  --allow-unauthenticated

echo "✅ Deploy finalizado"
