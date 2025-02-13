import asyncio
import os
from dotenv import load_dotenv
from openfga_sdk import (
    ClientConfiguration,
    Metadata,
    RelationMetadata,
    RelationReference,
    TypeDefinition,
    WriteAuthorizationModelRequest,
    Userset,
    OpenFgaClient,
)
from openfga_sdk.client.models import ClientTuple
from openfga_sdk.credentials import CredentialConfiguration, Credentials

load_dotenv()


async def initialize_fga():
    fga_configuration = ClientConfiguration(
        api_url=os.getenv("FGA_API_URL") or "api.us1.fga.dev",
        store_id=os.getenv("FGA_STORE_ID"),
        credentials=Credentials(
            method="client_credentials",
            configuration=CredentialConfiguration(
                api_issuer=os.getenv("FGA_API_TOKEN_ISSUER") or "auth.fga.dev",
                api_audience=os.getenv("FGA_API_AUDIENCE")
                or "https://api.us1.fga.dev/",
                client_id=os.getenv("FGA_CLIENT_ID"),
                client_secret=os.getenv("FGA_CLIENT_SECRET"),
            ),
        ),
    )

    async with OpenFgaClient(fga_configuration) as fga_client:
        # 01. WRITE MODEL
        user_type = TypeDefinition(type="user")

        doc_relations = dict(
            owner=Userset(this=dict()),
            viewer=Userset(this=dict()),
        )

        doc_metadata = Metadata(
            relations=dict(
                owner=RelationMetadata(
                    directly_related_user_types=[
                        RelationReference(type="user"),
                    ]
                ),
                viewer=RelationMetadata(
                    directly_related_user_types=[
                        RelationReference(type="user"),
                        RelationReference(type="user", wildcard={}),
                    ]
                ),
            )
        )

        document_type = TypeDefinition(
            type="doc", relations=doc_relations, metadata=doc_metadata
        )

        authorization_model_request = WriteAuthorizationModelRequest(
            schema_version="1.1",
            type_definitions=[user_type, document_type],
            conditions=dict(),
        )

        model = await fga_client.write_authorization_model(authorization_model_request)
        print("NEW MODEL ID:", model)

        # 02. CONFIGURE PRE-DEFINED TUPLES
        await fga_client.write_tuples(
            body=[
                ClientTuple(user="user:*", relation="viewer", object="doc:public-doc"),
                ClientTuple(
                    user="user:admin", relation="viewer", object="doc:private-doc"
                ),
            ],
        )


if __name__ == "__main__":
    asyncio.run(initialize_fga())
